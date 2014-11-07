var search = require('./search'),
	functions = require('./functions'),
	request = require('request'),
	semver = require('semver'),
	async = require('async'),
	Packages = {};

// Namespaces
Packages.registry = {};

Packages.getPlugins = function(version, callback) {
	search('nodebb-', function (err, data) {
		if (err) {
			throw new Error(err);
		}

		if (!version) {
			functions.getNodeBBVersion(function(err, version) {
				functions.getCompatibility(data, version, callback);
			});
		} else {
			functions.getCompatibility(data, version, callback);
		}
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
			if (!err && data) {
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

Packages.registry.get = function(name, callback) {
	if (!name) {
		return callback(new Error('name-required'));
	}

	request({
		url: 'https://skimdb.npmjs.com/registry/' + name,
		json: true
	}, function(err, res, body) {
		if (!err && res.statusCode === 200) {
			callback(undefined, body);
		} else {
			switch(res.statusCode) {
				case 404:
					err = new Error('not-found');
					break;

				default:
					err = err || new Error('registry-error');
					console.log(err.stack);
					break;
			}
			
			callback(err);
		}
	});
}

module.exports = Packages;