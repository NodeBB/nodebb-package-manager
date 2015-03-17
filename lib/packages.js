'use strict';
/* globals module, require */

var functions = require('./functions'),
	request = require('request'),
	semver = require('semver'),
	async = require('async'),
	winston = require('winston'),
	rdb = require('./redis'),
	skimdbCache = require('lru-cache')({
		max: 100,
		maxAge: 1000*60*60		// only cache for an hour
	}),
	Packages = {};

// Namespaces
Packages.registry = {};

Packages.getPlugins = function(version, callback) {
	if (Packages.cache) {
		callback(null, Packages.cache);
		return;
	}

	rdb.zrevrange('packages', 0, -1, function(err, packages) {
		var multi = rdb.multi();
		packages.forEach(function(pkgName) { multi.hgetall('package:' + pkgName); });
		multi.exec(function(err, packages) {
			if (!err) { Packages.cache = packages; }

			callback.apply(Packages, arguments);
			setTimeout(function() { delete Packages.cache; }, 1000*60*60);
		});
	});
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

	async.mapLimit(packages, 20, function(pkgName, next) {
		Packages.registry.get(pkgName, function(err, data) {
			if (!err && data && data.hasOwnProperty('versions')) {
				var versions = Object.keys(data.versions);

				// Sort the version keys in descending order
				versions = versions.sort(semver.compare).reverse();

				// Iterate successively through the versions, and if a match is found, break and suggest that version
				for(var x=0,numVersions=versions.length,versionObj;x<numVersions;x++) {
					versionObj = data.versions[versions[x]];
					if (versionObj.nbbpm && versionObj.nbbpm.compatibility && semver.satisfies(version, versionObj.nbbpm.compatibility)) {
						return next(undefined, {
							package: pkgName,
							version: versionObj.version,
							code: 'match-found',
							message: 'The plugin author suggests that you install v' + versionObj.version + ' for your copy of NodeBB v' + version
						});
					}
				}

				// None of the versions match
				next(undefined, {
					package: pkgName,
					version: 'latest',
					code: 'no-match',
					message: 'No suggested package version was supplied by the plugin author, be cautious when installing the latest package version'
				});
			} else {
				next(undefined, {
					package: pkgName,
					code: 'not-found',
					message: 'A package by the name of `' + pkgName + '` could not be found in the NodeBB Package Manager'
				});
			}
		});
	}, function(err, payload) {
		callback(err, payload.length > 1 ? payload : payload[0]);
	});
};

// Registry functions

Packages.registry.syncInitial = function() {
	winston.info('[packages.registry.syncInitial] Start...');

	var nodebbPackage = /^nodebb-(plugin|theme|widget)-.*/;

	request({
		url: 'https://registry.npmjs.com/-/_view/byKeyword?startkey=[%22nodebb%22]&endkey=[%22nodebb%22,{}]&group_level=2',		// wat.
		json: true
	}, function(err, res, body) {
		if (!err && res.statusCode === 200) {
			var packages = body.rows.map(function(row, next) {
					return row.key[1]
				}).filter(function(pkgName) {
					return nodebbPackage.test(pkgName);
				});

			console.log('packages!', packages.length);
		} else {
			winston.warn('[packages.registry.syncInitial] Unable to retrieve package list from npm!');
			if (err) { winston.error(err.stack); }
		}
	})
};

Packages.registry.sync = function(initial) {
	var now = new Date(),
		date = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();

	winston.info('[packages.registry.sync] Starting sync @ ' + date);

	var startkey = Date.now() - (1000*60*60),	// One hour ago
		nodebbPackage = /^nodebb-(plugin|theme|widget)-.*/,
		url = initial ? 'https://registry.npmjs.com/-/_view/byKeyword?startkey=[%22nodebb%22]&endkey=[%22nodebb%22,{}]&group_level=2' : ('https://registry.npmjs.com/-/_list/index/modified?startkey=' + startkey),
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

	// Replace saved data
	rdb.multi()
		.del('package:' + dist.name)
		.hmset('package:' + dist.name, metaData)
		.zadd('packages', syncDate, dist.name)
		.exec(callback);
};

Packages.registry.remove = function(pkgName, callback) {
	rdb.multi()
		.del('package:' + pkgName)
		.zrem('packages', pkgName)
		.exec(callback);
};

module.exports = Packages;