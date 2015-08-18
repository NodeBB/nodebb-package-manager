'use strict';
/* globals module, require */

var request = require('request'),
	semver = require('semver'),
	async = require('async'),
	winston = require('winston'),
	nodebb = require('./nodebb'),
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
Packages.registry = {};

Packages.getPlugins = function(version, callback) {
	if (pkgListCache.has(version)) {
		return callback(null, pkgListCache.get(version));
	}

	rdb.hgetall('packages:' + version, function(err, pkgTable) {
		if (err) {
			return callback(err, []);
		} else if (pkgTable === null) {
			pkgTable = [];
		}

		var multi = rdb.multi();
		Object.keys(pkgTable).forEach(function(pkgName) { multi.hgetall('package:' + pkgName); });
		multi.exec(function(err, packages) {
			if (err) {
				return callback(err);
			}

			// Override the "latest" value with the actual compatible version as calculated by nbbpm
			packages.forEach(function(pkgData) {
				if (pkgTable[pkgData.name] !== null) {
					pkgData.latest = pkgTable[pkgData.name];
				}
			});

			pkgListCache.set(version, packages);
			callback(null, packages);
		});
	});
};

Packages.getPlugin = function(pkgName, callback) {
	rdb.hgetall('package:' + pkgName, callback);
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

// Registry functions

Packages.registry.sync = function(initial) {
	var now = new Date(),
		date = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

	winston.info('[packages.registry.sync] Starting sync @ ' + date);

	var nodebbPackage = /^nodebb-(plugin|theme|widget)-.*/,
		url = initial ? 'https://registry.npmjs.com/-/_view/byKeyword?startkey=[%22nodebb%22]&endkey=[%22nodebb%22,{}]&group_level=2' : 'https://registry.npmjs.org/-/all/static/today.json',
		packages;

	request({
		url: url,
		json: true
	}, function(err, res, body) {
		if (!err && res.statusCode === 200) {
			if (!initial) {
				// Removing useless metadata
				delete body._updated;

				packages = Object.keys(body).filter(function(pkgName) {
					return pkgName.match(nodebbPackage);
				});
			} else {
				packages = body.rows.map(function(row, next) {
					return row.key[1]
				}).filter(function(pkgName) {
					return nodebbPackage.test(pkgName);
				});
			}

			if (!packages.length) {
				return winston.info('[packages.registry.sync] Sync complete.');
			}

			winston.info('[packages.registry.sync] Found ' + packages.length + ' package(s) in need of updating!');

			async.eachLimit(packages, 5, Packages.registry.update, function(err) {
				if (err) {
					console.log(err);
					winston.error('[packages.registry.sync] Sync encountered an error while updating registry: ' + err.message);
					winston.error(err.stack);
				}

				winston.info('[packages.registry.sync] Sync complete.');
			});
		} else {
			winston.warn('[packages.registry.sync] Unable to retrieve package list from npm!');
			if (err) { winston.error(err.stack); }
		}
	});
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
					url: 'https://skimdb.npmjs.com/registry/' + name,
					json: true
				}, function(err, res, body) {
					if (!err && res.statusCode === 200) {
						// Save to cache and return
						skimdbCache.set(name, body);
						next(undefined, body);
					} else {
						switch(res.statusCode) {
							case 404:
								err = new Error('not-found');
								break;

							default:
								err = err || new Error('registry-error');
								winston.error(err.stack);
								break;
						}
						
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
	var dist = pkgData.versions[pkgData['dist-tags'].latest],
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
	rdb.multi()
		.del('package:' + pkgName)
		.zrem('packages', pkgName)
		.exec(callback);
};

Packages.registry.buildCompatibilityTable = function(pkgData, callback) {
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
				if (versionObj.nbbpm && versionObj.nbbpm.compatibility && semver.satisfies(version, versionObj.nbbpm.compatibility)) {
					compatibility[version] = versionObj.version;
				}
			}
		}

		callback(null, compatibility);
	});
}

module.exports = Packages;