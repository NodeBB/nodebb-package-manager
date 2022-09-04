'use strict';

const request = require('request');
const semver = require('semver');
const async = require('async');
const winston = require('winston');
const nconf = require('nconf');
const util = require('util');
const pkgListCache = require('lru-cache')({
	maxAge: 1000 * 60 * 60, // only cache for an hour
});
const skimdbCache = require('lru-cache')({
	max: 100,
	maxAge: 1000 * 60 * 60, // only cache for an hour
});
const nodebb = require('./nodebb');
const analytics = require('./analytics');
const rdb = require('./redis');

const Packages = {};

// Namespaces
Packages.registry = {
	last_seq: undefined,
	seq_stale: 0,
};

Packages.clearCaches = function (pkgName) {
	if (pkgName) {
		skimdbCache.del(pkgName);
	}

	pkgListCache.reset();
};

Packages.getPlugins = function (version, callback) {
	nodebb.getVersions().then((versions) => {
		if (versions.indexOf(version) !== -1) {
			analytics.incr(`list.${version}`, 1);
		} else if (version === '') {
			analytics.incr('list.all', 1);
		}
	});

	if (pkgListCache.has(version)) {
		return callback(null, pkgListCache.get(version));
	}
	let pkgTable;
	async.waterfall([
		function (next) {
			if (version) {
				rdb.hgetall(`packages:${version}`, (err, _pkgTable) => {
					if (err) {
						return callback(err, []);
					}
					pkgTable = _pkgTable || {};
					next(null, Object.keys(pkgTable));
				});
			} else {
				rdb.zrange('packages', 0, -1, next);
			}
		},
		function (packages, next) {
			getPackagesData(packages, next);
		},
		function (packages, next) {
			// Filter out packages with no data (deleted in npm)
			packages = packages.filter(Boolean);

			// Override the "latest" value with the actual compatible version as calculated by nbbpm
			if (version) {
				packages.forEach((pkgData) => {
					if (pkgTable[pkgData.name] !== null) {
						pkgData.latest = pkgTable[pkgData.name];
					}
				});
			}
			checkUsage(version, packages, next);
		},
		function (packages, next) {
			pkgListCache.set(version || 'all', packages);
			next(null, packages);
		},
	], callback);
};

function getPackagesData(packages, callback) {
	const multi = rdb.multi();
	packages.forEach((pkgName) => {
		multi.hgetall(`package:${pkgName}`);
	});
	multi.exec(callback);
}

function checkUsage(nbbVersion, packages, callback) {
	if (!nbbVersion) {
		packages.forEach((data, index) => {
			if (data) {
				data.numInstalls = 0;
				data.isCompatible = false;
			}
		});
		return callback(null, packages);
	}
	const multi = rdb.multi();
	const multi2 = rdb.multi();

	const yesterday = Date.now() - 86400000;
	packages.forEach((pkgData) => {
		// count number of installs for pkgName on nbbVersion since yesterday
		multi.zcount(`nodebb:${nbbVersion}:plugin:${pkgData.name}`, yesterday, '+inf');

		// check if the latest version of this plugin is seen working on nbbVersion
		multi2.zscore(`plugin:${pkgData.name}:versions`, `${nbbVersion}_${pkgData.latest}`);
	});
	async.parallel({
		numInstalls: function (next) {
			multi.exec(next);
		},
		compatibility: function (next) {
			multi2.exec(next);
		},
	}, (err, results) => {
		if (err) {
			return callback(err);
		}
		packages.forEach((data, index) => {
			if (data) {
				data.numInstalls = results.numInstalls[index] || 0;
				data.isCompatible = results.compatibility[index] > 0;
			}
		});
		callback(null, packages);
	});
}

Packages.getPlugin = function (pkgName, callback) {
	async.parallel({
		pkgData: async.apply(Packages.registry.get, pkgName),
		payload: async.apply(rdb.hgetall.bind(rdb), `package:${pkgName}`),
	}, (err, results) => {
		const versions = [];
		// eslint-disable-next-line no-restricted-syntax
		for (const key in results.pkgData.versions) {
			if (results.pkgData.versions.hasOwnProperty(key)) {
				versions.push(key);
			}
		}
		results.payload.valid = versions;

		callback(err, !err ? results.payload : undefined);
	});
};

Packages.getCompatibilityBadge = async (pkgName) => {
	const versions = await nodebb.getVersions();
	const latest = versions[0];
	const suggest = util.promisify(Packages.suggest);
	const response = await suggest(pkgName, latest);

	return {
		compatible: !!response.version,
		nbbVersion: latest,
	};
};

Packages.suggest = function (packages, version, callback) {
	if (!packages) {
		return callback(new Error('parameter-missing'), {
			status: 'error',
			code: 'parameter-missing',
			message: 'The required parameter "package" was not sent. This value is the NodeBB package or packages that you are requesting a version to install.',
		});
	}

	if (!Array.isArray(packages)) {
		packages = [packages];
	}

	if (!version) {
		return callback(new Error('parameter-missing'), {
			status: 'error',
			code: 'parameter-missing',
			message: 'The required parameter "version" was not sent. This value is the NodeBB version that you are checking this package against.',
		});
	}

	rdb.hmget(`packages:${version}`, packages, (err, pkgVersions) => {
		if (err) {
			return callback(err);
		}

		const apiReturn = [];

		packages.forEach((pkgName, idx) => {
			analytics.incr(`package.${pkgName}`, 1);

			if (pkgVersions[idx] !== null) {
				apiReturn.push({
					package: pkgName,
					version: pkgVersions[idx],
					code: 'match-found',
					message: `The plugin author suggests that you install v${pkgVersions[idx]} for your copy of NodeBB v${version}`,
				});
			} else {
				apiReturn.push({
					package: pkgName,
					version: null,
					code: 'no-match',
					message: `For your copy of NodeBB v${version}, no suggested package version was supplied by the plugin author, installing this plugin is not recommended.`,
				});
			}
		});

		callback(null, apiReturn.length > 1 ? apiReturn : apiReturn[0]);
	});
};

Packages.getLatest = function (callback) {
	// eslint-disable-next-line handle-callback-err
	rdb.zrevrange('packages', 0, 9, (err, packages) => {
		const multi = rdb.multi();
		packages.forEach((pkgName) => {
			multi.hgetall(`package:${pkgName}`);
		});
		multi.exec(callback);
	});
};

Packages.rebuild = async () => {
	// Retrieve a new set of releases from GitHub
	winston.info(`[packages.rebuild] Rebuild triggered @ ${new Date().toISOString()}`);

	await nodebb.getVersions(true); // force rebuild of version cache

	return async.waterfall([
		function (next) {
			rdb.zrange('packages', 0, -1, next);
		},
		function (packages, next) {
			async.eachLimit(packages, 5, Packages.registry.update, next);
		},
		function (next) {
			pkgListCache.reset();
			winston.info(`[packages.rebuild] Rebuild complete @ ${new Date().toISOString()}`);
			next();
		},
	]);
};

Packages.saveUsage = function (data, callback) {
	const { id } = data;
	const { version } = data;
	const { plugins } = data;

	const now = Date.now();
	const multi = rdb.multi();

	multi.zadd('active:nodebbs', now, id);
	multi.zadd('active:nodebbs:versions', now, version);
	multi.zadd(`active:nodebbs:${version}`, now, id);

	plugins.forEach((plugin) => {
		multi.zadd('nodebb:version:plugins', now, `nodebb:${version}:plugin:${plugin.id}`);
		multi.zadd(`nodebb:${version}:plugin:${plugin.id}`, now, id);

		multi.zadd('plugin:id:versions', now, `plugin:${plugin.id}:versions`);
		multi.zadd(`plugin:${plugin.id}:versions`, now, `${version}_${plugin.version}`);
	});

	multi.exec(callback);
};

Packages.getUsage = function (callback) {
	const cutoff = Date.now() - 86400000; // 24 hours
	async.parallel({
		activeNodebbs: function (next) {
			rdb.zcount('active:nodebbs', cutoff, '+inf', next);
		},
		activeNodebbsByVersion: function (next) {
			rdb.zrevrangebyscore('active:nodebbs:versions', '+inf', cutoff, (err, versions) => {
				if (err) { return next(err); }
				async.map(versions, (version, next) => {
					rdb.zcard(`active:nodebbs:${version}`, next);
				}, (err, counts) => {
					if (err) { return next(err); }
					const data = {};
					versions.forEach((version, index) => {
						data[version] = counts[index];
					});
					next(null, data);
				});
			});
		},
	}, callback);
};

Packages.cleanUpUsage = function () {
	const cutoff = Date.now() - (86400000 * 2); // 48 hours

	// delete everything older than 48 hours
	async.parallel({
		versions: function (next) {
			rdb.zrange('active:nodebbs:versions', 0, -1, next);
		},
		plugins: function (next) {
			rdb.zrange('nodebb:version:plugins', 0, -1, next);
		},
		pluginVersions: function (next) {
			rdb.zrange('plugin:id:versions', 0, -1, next);
		},
	}, (err, results) => {
		if (err) {
			return winston.error(err);
		}
		const m = rdb.multi();
		results.versions.forEach((version) => {
			m.zremrangebyscore(`active:nodebbs:${version}`, '-inf', cutoff);
		});

		results.plugins.forEach((keyName) => {
			m.zremrangebyscore(keyName, '-inf', cutoff);
		});

		results.pluginVersions.forEach((keyName) => {
			m.zremrangebyscore(keyName, '-inf', cutoff);
		});

		m.zremrangebyscore('active:nodebbs:versions', '-inf', cutoff);
		m.zremrangebyscore('active:nodebbs', '-inf', cutoff);
		m.zremrangebyscore('nodebb:version:plugins', '-inf', cutoff);
		m.zremrangebyscore('plugin:id:versions', '-inf', cutoff);

		m.exec((err) => {
			if (err) {
				return winston.error(err);
			}
		});
	});
};

// Registry functions

Packages.registry.init = function (callback) {
	// Retrieve seq number from the local db, or if not, use provided number in environment variable
	rdb.get('npm:last_seq', (err, seq) => {
		if (err) {
			return callback(err);
		}

		Packages.registry.last_seq = seq || nconf.get('NPM_LAST_SEQ');

		if (!Packages.registry.last_seq) {
			Packages.registry.last_seq = 0;
		}

		winston.info(`[packages.registry.init] Using last_seq: ${Packages.registry.last_seq}`);
		callback();
	});
};

function getNodeBBPackagesFromNpm(callback) {
	let done = false;
	let from = 0;
	const nodebbPackage = /^(?:@[\w\-_]+\/)?nodebb-(plugin|theme|widget|rewards)-.*/;
	let packages = [];
	const pageSize = 250;
	async.whilst(function (cb) {
		cb(null, !done)
	}, function (next) {
		const url = `https://registry.npmjs.com/-/v1/search?text=nodebb-&size=${pageSize}&from=${from}`
		request({
			url: url,
			json: true,
		}, (err, res, body) => {
			if (err || res.statusCode !== 200) {
				return next(err || new Error(`Error loading packages from npm ${res.statusCode}`));
			}
			if (body.objects.length === 0) {
				done = true;
			} else {
				packages = packages.concat(
					body.objects.map(pkg => pkg.package.name)
						.filter(pkgName => pkgName.match(nodebbPackage))
				);
				from += pageSize;
			}
			next();
		});
	}, function (err) {
		callback(err, packages);
	});
}

Packages.registry.sync = function (initial) {
	const now = new Date();
	const date = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

	winston.info(`[packages.registry.sync] Starting sync @ ${date}`);
	winston.verbose(`[packages.registry.sync] last_seq: ${Packages.registry.last_seq}`);

	getNodeBBPackagesFromNpm(function (err, packages) {
		if (!err && packages.length) {
			winston.info(`[packages.registry.sync] Found ${packages.length} package(s) in need of updating!`);

			async.eachLimit(
				packages,
				100,
				Packages.registry.update,
				Packages.registry.syncComplete
			);
		} else {
			winston.warn('[packages.registry.sync] Unable to retrieve package list from npm!');
			if (err) { winston.error(err.stack); }
		}
	});
};

Packages.registry.syncComplete = function (err) {
	if (err) {
		winston.error(`[packages.registry.sync] Sync encountered an error while updating registry: ${err.message}`);
		winston.error(err.stack);
		return;
	}
	const now = new Date();
	const date = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
	winston.info(`[packages.registry.sync] Sync complete @ ${date}`);
	Packages.clearCaches();
};

Packages.registry.get = function (name, callback) {
	if (!name) {
		return callback(new Error('name-required'));
	}

	async.waterfall([
		function (next) {
			// Check cache first
			next(undefined, skimdbCache.has(name) ? skimdbCache.get(name) : null);
		},
		function (pkgData, next) {
			if (pkgData !== null) {
				next(undefined, pkgData);
			} else {
				request({
					url: `https://replicate.npmjs.com/registry/${encodeURIComponent(name)}`,
					json: true,
				}, (err, res, body) => {
					if (!err && res.statusCode === 200) {
						// Save to cache and return
						skimdbCache.set(name, body);
						next(undefined, body);
					} else if (res.statusCode === 404) {
						body.name = name;
						next(undefined, body);
					} else {
						err = err || new Error('registry-error');
						winston.error(err.stack);
						next(err);
					}
				});
			}
		},
	], callback);
};

Packages.registry.update = function (pkgName, next) {
	// winston.info(`[packages.registry.update] Starting update for ${pkgName}`);
	async.waterfall([
		async.apply(Packages.registry.get, pkgName),
		Packages.registry.save,
	], next);
};

Packages.registry.save = function (pkgData, callback) {
	// Handle packages that have been deleted from npm
	if (pkgData.hasOwnProperty('error') && pkgData.error === 'not_found' && pkgData.reason === 'deleted') {
		return Packages.registry.remove(pkgData.name, callback);
	} else if (!['name', 'versions', 'time'].every(prop => pkgData.hasOwnProperty(prop))) {
		// One or more required properties are missing from the npm payload, skip this package.
		winston.warn(`[packages.registry.save] Required parameters are missing for package "${pkgData.name}"`);
		return callback();
	}

	const latest = Object.keys(pkgData.versions).pop();
	const dist = pkgData.versions[latest];
	const syncDate = Date.now();

	if (dist.hasOwnProperty('nbbpm') && dist.nbbpm.index === false) {
		winston.verbose(`[packages.registry.save] SKIP ${pkgData.name}`);
		return Packages.registry.remove(pkgData.name, callback);
	}

	// winston.info(`[packages.registry.save] Updating ${pkgData.name}`);

	const metaData = {
		name: dist.name,
		updated: new Date(pkgData.time[dist.version]).getTime(),
	};
	if (dist.hasOwnProperty('description')) { metaData.description = dist.description; }
	if (dist.hasOwnProperty('version')) { metaData.latest = dist.version; }
	if (dist.hasOwnProperty('homepage')) { metaData.url = dist.homepage; }

	// eslint-disable-next-line handle-callback-err
	Packages.registry.buildCompatibilityTable(pkgData, (err, compatibility) => {
		// Replace saved data
		const multi = rdb.multi();

		multi.del(`package:${dist.name}`);
		multi.hmset(`package:${dist.name}`, metaData);
		multi.zadd('packages', syncDate, dist.name);

		// Process compatibility table
		Object.keys(compatibility).forEach((nbbVersion) => {
			const pluginVersion = compatibility[nbbVersion];
			if (pluginVersion !== null) {
				multi.hset(`packages:${nbbVersion}`, dist.name, pluginVersion);
			}
		});

		// Persist to db
		multi.exec(callback);
	});
};

Packages.registry.remove = function (pkgName, callback) {
	winston.verbose(`[packages.registry.remove] Removing ${pkgName} from registry`);
	rdb.multi()
		.del(`package:${pkgName}`)
		.zrem('packages', pkgName)
		.exec(callback);
};

Packages.registry.buildCompatibilityTable = function (pkgData, callback) {
	winston.verbose(`[packages.registry.buildCompatibilityTable] Start "${pkgData.name}"`);

	let version;
	const compatibility = {};
	const pkgVersions = Object.keys(pkgData.versions).sort(semver.compare);

	// eslint-disable-next-line handle-callback-err
	nodebb.getVersions().then((versions) => {
		// Iterate successively through the package's versions, checking against all NodeBB versions.
		// If a compatibility match is found, add it to the hash table
		for (let y = 0, numNbbVersions = versions.length; y < numNbbVersions; y++) {
			version = versions[y];
			compatibility[version] = null;

			const numVersions = pkgVersions.length;
			let versionObj;
			for (let x = 0; x < numVersions; x++) {
				versionObj = pkgData.versions[pkgVersions[x]];
				if (
					!versionObj.deprecated && versionObj.nbbpm && versionObj.nbbpm.compatibility &&
					semver.satisfies(version, versionObj.nbbpm.compatibility)
				) {
					compatibility[version] = versionObj.version;
				}
			}
		}

		winston.verbose(`[packages.registry.buildCompatibilityTable] Finish "${pkgData.name}"`);
		callback(null, compatibility);
	});
};

module.exports = Packages;
