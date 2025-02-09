/* eslint-disable prefer-arrow-callback */

'use strict';

const cronJob = require('cron').CronJob;
const winston = require('winston');
const async = require('async');
const nconf = require('nconf');
const geoip = require('geoip-lite');
const LRUCache = require('lru-cache');
const rdb = require('./redis');
const nodebb = require('./nodebb');
const countryCodes = require('./countryCodes.json');

const Analytics = module.exports;
Analytics.data = {};
Analytics.summary = {};

const trendingCache = LRUCache({
	max: 10,
	maxAge: 1000 * 60 * 60 * 6,
});

Analytics.init = function () {
	new cronJob(
		`*/${(nconf.get('ANALYTICS_PERSIST_FREQ') || '30')} * * * * *`,
		Analytics.flush,
		null,
		true
	);
};

Analytics.incr = function (key, by) {
	Analytics.data[key] = (Analytics.data[key] || 0) + parseInt(by, 10);
	return true;
};

// Flushes the collected data to the database and resets all counters
Analytics.flush = function () {
	winston.verbose('[analytics.flush] Starting flush');
	const multi = rdb.multi();
	const hour = new Date();
	const day = new Date();
	const month = new Date();

	// Reset timestamp to the current hour/day/month
	hour.setHours(hour.getHours(), 0, 0, 0);
	day.setHours(0, 0, 0, 0);
	month.setDate(1);
	month.setHours(0, 0, 0, 0);

	for (const [key, value] of Object.entries(Analytics.data)) {
		winston.verbose(`[analytics.flush] Persisting ${key}, value: ${value}`);
		multi.zincrby(`analytics:${key}:hourly`, value, hour.getTime());
		multi.zincrby(`analytics:${key}:daily`, value, day.getTime());
		multi.zincrby(`analytics:${key}:monthly`, value, month.getTime());
	}

	multi.exec((err) => {
		if (err) {
			winston.error(err.stack);
			return;
		}
		// Reset counters
		for (const [key] of Object.entries(Analytics.data)) {
			delete Analytics.data[key];
		}
		winston.verbose('[analytics.flush] Flush complete');
	});
};

Analytics.summary = {};

Analytics.summary.index = function (callback) {
	const hour = new Date();
	hour.setHours(new Date().getHours(), 0, 0, 0);

	async.waterfall([
		function (next) {
			nodebb.getVersions().then(next);
		},
		function (versions, next) {
			// We'll only want to chart the latest 3 versions
			versions = versions.slice(0, 3);
			async.map(versions, function (version, next) {
				// For each version, grab the last 24 hours of data
				const calls = [];
				for (let x = 23; x >= 0; x--) {
					calls.push(async.apply(rdb.zscore.bind(rdb), `analytics:list.${version}:hourly`, hour - (1000 * 60 * 60 * x)));
				}
				async.parallel(calls, next);
			}, function (err, stats) {
				if (err) {
					return next(err);
				}
				// Replace nulls with zeroes
				stats = stats.map(function (stat) {
					return stat.map(function (value) {
						return parseInt(value, 10) || 0;
					});
				});

				// Add labels
				stats = stats.map(function (set, idx) {
					return {
						data: set,
						label: versions[idx],
					};
				});

				next(null, stats);
			});
		},
	], callback);
};

Analytics.summary.top = function (period, callback) {
	// Summarises package downloads for the specified period and reports the top 10
	const day = new Date();
	const interval = 1000 * 3600 * 24;
	let numDays = 0;

	day.setHours(0, 0, 0, 0);

	switch (period) {
		case 'week':
			numDays = 7;
			break;
		case 'month':
			numDays = 30;
			break;
	}

	const cachedData = trendingCache.get(period);
	if (cachedData) {
		return callback(null, cachedData);
	}
	let keys = [];
	async.waterfall([
		async.apply(rdb.keys.bind(rdb), 'analytics:package.*:daily'),
		function (_keys, next) {
			keys = _keys;
			if (numDays) {
				async.map(keys, function (key, next) {
					const multi = rdb.multi();
					// Get download counts per package
					for (let x = 0; x < numDays; x++) {
						multi.zscore(key, day - (interval * x));
					}
					multi.exec(function (err, raw) {
						if (err) {
							return next(err);
						}

						const sum = raw.reduce(function (cur, next) {
							return (parseInt(cur, 10) || 0) + (parseInt(next, 10) || 0);
						});

						next(null, sum);
					});
				}, next);
			} else {
				const multi = rdb.multi();

				// All-time statistics!
				keys.forEach(function (key) {
					multi.zrange(key, 0, -1, 'WITHSCORES');
				});

				multi.exec(function (err, counts) {
					if (err) {
						return next(err);
					}
					// Reduce sets
					counts = counts.map(function (set) {
						return set.reduce(function (cur, next, idx) {
							return idx % 2 ? cur + parseInt(next, 10) : cur;
						}, 0);
					});

					next(null, counts);
				});
			}
		},
		function (counts, next) {
			// Associate counts with package names
			counts = counts.map(function (count, idx) {
				return {
					label: keys[idx].split(':')[1].slice(8),
					value: count,
				};
			}).sort(function (a, b) {
				return a.value < b.value ? 1 : -1;
			}).slice(0, 10);
			trendingCache.set(period, counts);
			next(null, counts);
		},
	], callback);
};

Analytics.summary.geo = function (callback) {
	// Retrieve IPs from the past 48 hours
	const now = Date.now();
	const from = now - (1000 * 60 * 60 * 24 * 2);
	const hash = {};
	let returnArr = [];

	rdb.zrangebyscore('ip:recent', from, now, function (err, set) {
		if (err) {
			return callback(err);
		}

		set
			.map(function (address) {
				return geoip.lookup(address);
			})
			.filter(Boolean)
			.forEach(function (obj) {
				if (obj.hasOwnProperty('country') || obj.country) {
					hash[obj.country] = hash[obj.country] || 0;
					hash[obj.country] += 1;
				}
			});

		for (const [country, count] of Object.entries(hash)) {
			returnArr.push({
				country: country,
				count: count,
			});
		}

		// Use nicer country names
		returnArr = returnArr.map(function (entry) {
			entry.country = countryCodes[entry.country] || entry.country;
			return entry;
		});

		callback(null, returnArr.sort(function (a, b) {
			return a.count < b.count ? 1 : -1;
		}));
	});
};
