var cronJob = require('cron').CronJob,
	winston = require('winston'),
	async = require('async'),
	rdb = require('./redis'),
	nodebb = require('./nodebb'),

	Analytics = {
		data: {},
		summary: {}
	};

Analytics.init = function() {
	new cronJob('*/' + (process.env.ANALYTICS_PERSIST_FREQ || '10') + ' * * * * *', Analytics.flush, null, true);
};

Analytics.incr = function(key, by) {
	Analytics.data[key] = (Analytics.data[key] || 0) + parseInt(by, 10);
	return true;
};

// Flushes the collected data to the database and resets all counters
Analytics.flush = function() {
	winston.verbose('[analytics.flush] Starting flush');
	var multi = rdb.multi(),
		hour = new Date(),
		day = new Date(),
		month = new Date();

	// Reset timestamp to the current hour/day/month
	hour.setHours(hour.getHours(), 0, 0, 0);
	day.setHours(0, 0, 0, 0);
	month.setDate(1);
	month.setHours(0, 0, 0, 0);

	for(var key in Analytics.data) {
		winston.verbose('[analytics.flush] Persisting ' + key + ', value: ' + Analytics.data[key]);
		multi.zincrby('analytics:' + key + ':hourly', Analytics.data[key], hour.getTime());
		multi.zincrby('analytics:' + key + ':daily', Analytics.data[key], day.getTime());
		multi.zincrby('analytics:' + key + ':monthly', Analytics.data[key], month.getTime());
	}

	multi.exec(function(err) {
		// Reset counters
		for(var key in Analytics.data) {
			delete Analytics.data[key];
		}
		winston.verbose('[analytics.flush] Flush complete');
	});
};

Analytics.summary = {};

Analytics.summary.index = function(callback) {
	var hour = new Date();
	hour.setHours(new Date().getHours(), 0, 0, 0);

	async.waterfall([
		async.apply(nodebb.getVersions),
		function(versions, next) {
			// We'll only want to chart the latest 3 versions
			versions = versions.slice(0, 3);
			async.map(versions, function(version, next) {
				// For each version, grab the last 24 hours of data
				var calls = [];
				for(x=23;x>=0;x--) {
					calls.push(async.apply(rdb.zscore.bind(rdb), 'analytics:list.' + version + ':hourly', hour - (1000*60*60*x)));
				}
				async.parallel(calls, next);
			}, function(err, stats) {
				// Replace nulls with zeroes
				stats = stats.map(function(stat) {
					return stat.map(function(value) {
						return parseInt(value, 10) || 0;
					});
				});

				// Add labels
				stats = stats.map(function(set, idx) {
					return {
						data: set,
						label: versions[idx]
					}
				});

				next(err, stats);
			});
		}
	], callback);
};

Analytics.summary.top = function(period, callback) {
	// Summarises package downloads for the specified period and reports the top 10
	var day = new Date(),
		interval = 1000 * 3600 * 24,
		numDays;

	day.setHours(0, 0, 0, 0);

	switch(period) {
		case 'week':
			numDays = 7;
			break;
		case 'month':
			numDays = 30;
			break;
	}

	async.waterfall([
		async.apply(rdb.keys.bind(rdb), 'analytics:package.*:daily'),
		function(keys, next) {

			if (numDays) {
				async.mapSeries(keys, function(key, next) {
					var multi = rdb.multi();
					// Get download counts per package
					for(var x=0;x<numDays;x++) {
						multi.zscore(key, day-(interval*x));
					}
					multi.exec(function(err, raw) {
						if (err) {
							return next(err);
						}

						var sum = raw.reduce(function(cur, next) {
							return (parseInt(cur, 10) || 0) + (parseInt(next, 10) || 0);
						});
						raw.length = 0;
						next(null, sum);
					});
				}, function(err, counts) {
					// Associate counts with package names
					if (err) {
						return next(err);
					}

					counts = counts.map(function(count, idx) {
						return {
							label: keys[idx].split(':')[1].slice(8),
							value: count
						}
					}).sort(function(a, b) {
						return a.value < b.value ? 1 : -1;
					}).slice(0, 5);

					next(null, counts);
				});
			} else {
				var multi = rdb.multi();

				// All-time statistics!
				keys.forEach(function(key) {
					multi.zrange(key, 0, -1, 'WITHSCORES');
				});

				multi.exec(function(err, counts) {
					// Reduce sets
					counts = counts.map(function(set) {
						return set.reduce(function(cur, next, idx) {
							return idx % 2 ? cur+parseInt(next, 10) : cur;
						}, 0);
					});

					// Associate counts with package names
					counts = counts.map(function(count, idx) {
						return {
							label: keys[idx].split(':')[1].slice(8),
							value: count
						}
					}).sort(function(a, b) {
						return a.value < b.value ? 1 : -1;
					}).slice(0, 5);

					next(null, counts);
				});
			}
		}
	], callback);
}

module.exports = Analytics;