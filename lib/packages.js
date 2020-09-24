'use strict';
/* globals module, require */

var request = require('request'),
	semver = require('semver'),
	async = require('async'),
	winston = require('winston'),
	nconf = require('nconf'),
	nodebb = require('./nodebb'),
	analytics = require('./analytics'),
	rdb = require('./redis'),
	skimdbCache = require('lru-cache')({
		max: 100,
		maxAge: 1000*60*60		// only cache for an hour
	}),
	pkgListCache = require('lru-cache')({
		maxAge: 1000*60*60		// only cache for an hour
	}),
	Packages = {};

// Namespaces
Packages.registry = {
	last_seq: undefined,
	seq_stale: 0
};

Packages.clearCaches = function(pkgName) {
	if (pkgName) {
		skimdbCache.del(pkgName);
	}

	pkgListCache.reset();
};

Packages.getPlugins = function(version, callback) {
	nodebb.getVersions(function(err, versions) {
		if (versions.indexOf(version) !== -1) {
			analytics.incr('list.' + version, 1);
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
				rdb.hgetall('packages:' + version, function(err, _pkgTable) {
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
				packages.forEach(function(pkgData) {
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
		}
	], callback);
};

function getPackagesData(packages, callback) {
	var multi = rdb.multi();
	packages.forEach(function(pkgName) {
		multi.hgetall('package:' + pkgName);
	});
	multi.exec(callback);
}

function checkUsage(nbbVersion, packages, callback) {
	var multi = rdb.multi();
	var multi2 = rdb.multi();

	const yesterday = Date.now() - 86400000;
	packages.forEach(function(pkgData) {
		// count number of installs for pkgName on nbbVersion since yesterday
		multi.zcount('nodebb:' + nbbVersion + ':plugin:' + pkgData.name, yesterday, '+inf');

		// check if the latest version of this plugin is seen working on nbbVersion
		multi2.zscore('plugin:' + pkgData.name + ':versions', nbbVersion + '_' + pkgData.latest);
	});
	async.parallel({
		numInstalls: function (next) {
			multi.exec(next);
		},
		compatibility: function (next) {
			multi2.exec(next);
		},
	}, function (err, results) {
		if (err) {
			return callback(err);
		}
		packages.forEach(function (data, index) {
			if (data) {
				data.numInstalls = results.numInstalls[index] || 0;
				data.isCompatible = results.compatibility[index] > 0;
			}
		});
		callback(null, packages);
	});
}

Packages.getPlugin = function(pkgName, callback) {
	async.parallel({
		pkgData: async.apply(Packages.registry.get, pkgName),
		payload: async.apply(rdb.hgetall.bind(rdb), 'package:' + pkgName),
	}, function (err, results) {
		var versions = [];
		for (var key in results.pkgData.versions) {
			if (results.pkgData.versions.hasOwnProperty(key)) {
				versions.push(key);
			}
		}
		results.payload.valid = versions;

		callback(err, !err ? results.payload : undefined);
	});
};

Packages.getCompatibilityBadge = function(pkgName, callback) {
	nodebb.getVersions(function(err, versions) {
		if (err) {
			return callback(err);
		}

		var latest = versions[0];
		Packages.suggest(pkgName, latest, function(err, response) {
			if (err) {
				return callback(err);
			}

			callback(null, {
				compatible: !!response.version,
				nbbVersion: latest
			});
		});
	})
};

Packages.suggest = function(packages, version, callback) {
	if (!packages) {
		return callback(new Error('parameter-missing'), {
			status: 'error',
			code: 'parameter-missing',
			message: 'The required parameter "package" was not sent. This value is the NodeBB package or packages that you are requesting a version to install.'
		});

	}

	if (!Array.isArray(packages)) {
		packages = [packages];
	}

	if (!version) {
		return callback(new Error('parameter-missing'), {
			status: 'error',
			code: 'parameter-missing',
			message: 'The required parameter "version" was not sent. This value is the NodeBB version that you are checking this package against.'
		});
	}

	rdb.hmget('packages:' + version, packages, function(err, pkgVersions) {
		if (err) {
			return callback(err);
		}

		var apiReturn = [];

		packages.forEach(function(pkgName, idx) {
			analytics.incr('package.' + pkgName, 1);

			if (pkgVersions[idx] !== null) {
				apiReturn.push({
					package: pkgName,
					version: pkgVersions[idx],
					code: 'match-found',
					message: 'The plugin author suggests that you install v' + pkgVersions[idx] + ' for your copy of NodeBB v' + version
				});
			} else {
				apiReturn.push({
					package: pkgName,
					version: null,
					code: 'no-match',
					message: 'For your copy of NodeBB v' + version + ', no suggested package version was supplied by the plugin author, installing this plugin is not recommended.'
				});
			}
		});

		callback(null, apiReturn.length > 1 ? apiReturn : apiReturn[0]);
	});
};

Packages.getLatest = function(callback) {
	rdb.zrevrange('packages', 0, 9, function(err, packages) {
		var multi = rdb.multi();
		packages.forEach(function(pkgName) {
			multi.hgetall('package:' + pkgName);
		});
		multi.exec(callback);
	});
};

Packages.rebuild = function(callback) {
	// Retrieve a new set of releases from GitHub
	winston.info('[packages.rebuild] Rebuild triggered @ ' + new Date().toISOString());
	callback = callback || function() {};

	async.waterfall([
		async.apply(nodebb.getVersions, true),
		function(versions, next) {
			rdb.zrange('packages', 0, -1, next);
		},
		function(packages, next) {
			async.eachLimit(packages, 5, Packages.registry.update, next);
		},
		function(next) {
			pkgListCache.reset();
			winston.info('[packages.rebuild] Rebuild complete @ ' + new Date().toISOString());
			next();
		}
	], callback);
};

Packages.saveUsage = function (data, callback) {
	const id = data.id;
	const version = data.version;
	const plugins = data.plugins;

	const now = Date.now();
	const multi = rdb.multi();

	multi.zadd('active:nodebbs', now, id);
	multi.zadd('active:nodebbs:versions', now, version);
	multi.zadd('active:nodebbs:' + version, now, id);

	plugins.forEach(function (plugin) {
		multi.zadd('nodebb:version:plugins', now, 'nodebb:' + version + ':plugin:' + plugin.id);
		multi.zadd('nodebb:' + version + ':plugin:' + plugin.id, now, id);

		multi.zadd('plugin:id:versions', now, 'plugin:' + plugin.id + ':versions');
		multi.zadd('plugin:' + plugin.id + ':versions', now, version + '_' + plugin.version);
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
			rdb.zrevrangebyscore('active:nodebbs:versions', '+inf', cutoff, function (err, versions) {
				if (err) { return next(err); }
				async.map(versions, function (version, next) {
					rdb.zcard('active:nodebbs:' + version, next);
				}, function (err, counts) {
					if (err) { return next(err); }
					const data = {};
					versions.forEach(function (version, index) {
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
		versions:function (next) {
			rdb.zrange('active:nodebbs:versions', 0, -1, next);
		},
		plugins: function (next) {
			rdb.zrange('nodebb:version:plugins', 0, -1, next);
		},
		pluginVersions: function (next) {
			rdb.zrange('plugin:id:versions', 0, -1, next);
		},
	}, function (err, results) {
		if (err) {
			return winston.error(err);
		}
		const m = rdb.multi();
		results.versions.forEach(function (version) {
			m.zremrangebyscore('active:nodebbs:' + version, '-inf', cutoff);
		});

		results.plugins.forEach(function (keyName) {
			m.zremrangebyscore(keyName, '-inf', cutoff);
		});

		results.pluginVersions.forEach(function (keyName) {
			m.zremrangebyscore(keyName, '-inf', cutoff)
		});

		m.zremrangebyscore('active:nodebbs:versions', '-inf', cutoff);
		m.zremrangebyscore('active:nodebbs', '-inf', cutoff);
		m.zremrangebyscore('nodebb:version:plugins', '-inf', cutoff);
		m.zremrangebyscore('plugin:id:versions', '-inf', cutoff);

		m.exec(function (err) {
			if (err) {
				return winston.error(err);
			}
		});
	});
};

// Registry functions

Packages.registry.init = function(callback) {
	// Retrieve seq number from the local db, or if not, use provided number in environment variable
	rdb.get('npm:last_seq', function(err, seq) {
		if (err) {
			return callback(err);
		}

		Packages.registry.last_seq = seq || nconf.get('NPM_LAST_SEQ');

		if (!Packages.registry.last_seq) {
			Packages.registry.last_seq = 0;
		}

		winston.info('[packages.registry.init] Using last_seq: ' + Packages.registry.last_seq);
		callback();
	});
};

Packages.registry.sync = function(initial) {
	var now = new Date(),
		date = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

	winston.info('[packages.registry.sync] Starting sync @ ' + date);
	winston.verbose('[packages.registry.sync] last_seq: ' + Packages.registry.last_seq);

	const nodebbPackage = /^nodebb-(plugin|theme|widget)-.*/;
	// the initial url no longer seems to work. Addl. research is required
	const url = initial ? 'https://registry.npmjs.com/-/_view/byKeyword?startkey=[%22nodebb%22]&endkey=[%22nodebb%22,{}]&group_level=2' : 'https://replicate.npmjs.com/registry/_changes?since=' + Packages.registry.last_seq;
	let packages;

	request({
		url: url,
		json: true
	}, function(err, res, body) {
		if (!err && res.statusCode === 200) {
			if (typeof body === 'string') {
				try {
					body = JSON.parse(body);
				} catch (err) {
					if (err) { winston.error(err.stack); }
					return;
				}
			}
			if (!initial) {
				// Track instances where no packages returned by npm (last_seq unchanged)
				if (parseInt(Packages.registry.last_seq, 10) === parseInt(body.last_seq, 10)) {
					Packages.registry.seq_stale++;
				} else {
					Packages.registry.seq_stale = 0;
				}

				Packages.registry.last_seq = body.last_seq,

				body.results = body.results || [];

				packages = body.results.map(function(changeset) {
					return changeset.id;
				}).filter(function(pkgName) {
					return pkgName.match(nodebbPackage);
				});
			} else {
				body.rows = body.rows || [];

				packages = body.rows.map(function(row, next) {
					return row.key[1]
				}).filter(function(pkgName) {
					return nodebbPackage.test(pkgName);
				});
			}

			if (!packages.length) {
				winston.info('[packages.registry.sync] No packages in need of updating, updating last_seq');
				return Packages.registry.syncComplete();
			}

			winston.info('[packages.registry.sync] Found ' + packages.length + ' package(s) in need of updating!');

			async.eachLimit(packages, 5, Packages.registry.update, Packages.registry.syncComplete);
		} else {
			winston.warn('[packages.registry.sync] Unable to retrieve package list from npm!');
			if (err) { winston.error(err.stack); }
		}
	});
};

Packages.registry.syncComplete = function(err) {
	if (err) {
		console.log(err);
		winston.error('[packages.registry.sync] Sync encountered an error while updating registry: ' + err.message);
		winston.error(err.stack);
	}

	if (Packages.registry.seq_stale < 4) {
		Packages.clearCaches();
		rdb.set('npm:last_seq', Packages.registry.last_seq, function(err) {
			if (err) {
				winston.error('[packages.registry.sync] Sync encountered an error while updating last_seq');
				winston.error(err.stack);
				return;
			}
		});

		winston.info('[packages.registry.sync] Sync complete, new last_seq: ' + Packages.registry.last_seq);
	} else {
		winston.warn('[packages.registry.sync] Stale return from npm detected! Resetting last_seq...');
		Packages.registry.last_seq = 0;
		rdb.set('npm:last_seq', 0, function(err) {
			if (err) {
				winston.error('[packages.registry.sync] Sync encountered an error while updating last_seq');
				winston.error(err.stack);
				return;
			}
		});
	}
};

Packages.registry.get = function(name, callback) {
	if (!name) {
		return callback(new Error('name-required'));
	}

	async.waterfall([
		function(next) {
			// Check cache first
			next(undefined, skimdbCache.has(name) ? skimdbCache.get(name) : null);
		},
		function(pkgData, next) {
			if (pkgData !== null) {
				next(undefined, pkgData);
			} else {
				request({
					url: 'https://replicate.npmjs.com/registry/' + name,
					json: true
				}, function(err, res, body) {
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
		}
	], callback);
};

Packages.registry.update = function(pkgName, next) {
	async.waterfall([
		async.apply(Packages.registry.get, pkgName),
		Packages.registry.save
	], next);
};

Packages.registry.save = function(pkgData, callback) {
	// Handle packages that have been deleted from npm
	if (pkgData.hasOwnProperty('error') && pkgData.error === 'not_found' && pkgData.reason === 'deleted') {
		return Packages.registry.remove(pkgData.name, callback);
	} else if (!['name', 'versions', 'time'].every(prop => pkgData.hasOwnProperty(prop))) {
		// One or more required properties are missing from the npm payload, skip this package.
		winston.warn('[packages.registry.save] Required parameters are missing for package "' + pkgData.name + '"');
		return callback();
	}

	var latest = Object.keys(pkgData.versions).pop(),
		dist = pkgData.versions[latest],
		syncDate = Date.now();

	if (dist.hasOwnProperty('nbbpm') && dist.nbbpm.index === false) {
		winston.info('[packages.registry.save] SKIP ' + pkgData.name);
		return Packages.registry.remove(pkgData.name, callback);
	}

	winston.info('[packages.registry.save] Updating ' + pkgData.name);

	// If latest dist data says this package isn't to be indexed, skip (or remove from index)
	if (dist.hasOwnProperty('nbbpm') && dist.nbbpm.index === false) { return Packages.registry.delete(dist.name, callback); }

	var metaData = {
			name: dist.name,
			updated: new Date(pkgData.time[dist.version]).getTime()
		};
	if (dist.hasOwnProperty('description')) { metaData.description = dist.description; }
	if (dist.hasOwnProperty('version')) { metaData.latest = dist.version; }
	if (dist.hasOwnProperty('homepage')) { metaData.url = dist.homepage; }

	Packages.registry.buildCompatibilityTable(pkgData, function(err, compatibility) {
		// Replace saved data
		var multi = rdb.multi();

		multi.del('package:' + dist.name)
		multi.hmset('package:' + dist.name, metaData)
		multi.zadd('packages', syncDate, dist.name)

		// Process compatibility table
		for(var nbbVersion in compatibility) {
			var pluginVersion = compatibility[nbbVersion];
			if (pluginVersion !== null) {
				multi.hset('packages:' + nbbVersion, dist.name, pluginVersion)
			}
		}

		// Persist to db
		multi.exec(callback);
	});

};

Packages.registry.remove = function(pkgName, callback) {
	winston.info('[packages.registry.remove] Removing ' + pkgName + ' from registry');
	rdb.multi()
		.del('package:' + pkgName)
		.zrem('packages', pkgName)
		.exec(callback);
};

Packages.registry.buildCompatibilityTable = function(pkgData, callback) {
	winston.verbose('[packages.registry.buildCompatibilityTable] Start "' + pkgData.name + '"');

	var version,
		compatibility = {},
		pkgVersions = Object.keys(pkgData.versions).sort(semver.compare);

	nodebb.getVersions(function(err, versions) {
		// Iterate successively through the package's versions, checking against all NodeBB versions.
		// If a compatibility match is found, add it to the hash table
		for(var y=0,numNbbVersions=versions.length;y<numNbbVersions;y++) {
			version = versions[y];
			compatibility[version] = null;

			for(var x=0,numVersions=pkgVersions.length,versionObj;x<numVersions;x++) {
				versionObj = pkgData.versions[pkgVersions[x]];
				if (!versionObj.deprecated && versionObj.nbbpm && versionObj.nbbpm.compatibility && semver.satisfies(version, versionObj.nbbpm.compatibility)) {
					compatibility[version] = versionObj.version;
				}
			}
		}

		winston.verbose('[packages.registry.buildCompatibilityTable] Finish "' + pkgData.name + '"');
		callback(null, compatibility);
	});
};

module.exports = Packages;