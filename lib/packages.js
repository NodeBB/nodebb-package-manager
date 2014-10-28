var search = require('./search'),
	functions = require('./functions'),
	request = require('request'),
	semver = require('semver'),
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

Packages.suggest = function(name, version, callback) {
	if (!name) {
		return callback(new Error('not-found'));
	}

	if (!version) {
		return callback(new Error('nodebb-version-required'));
	}

	Packages.registry.get(name, function(err, data) {
		if (!err && data) {
			var versions = Object.keys(data.versions);

			// Sort the version keys in descending order
			versions = versions.sort(semver.compare).reverse();

			// Iterate successively through the versions, and if a match is found, break and suggest that version
			for(var x=0,numVersions=versions.length,versionObj;x<numVersions;x++) {
				versionObj = data.versions[versions[x]];
				if (versionObj.nbbpm && versionObj.nbbpm.compatibility && semver.satisfies(version, versionObj.nbbpm.compatibility)) {
					return callback(undefined, versionObj.version);
				}
			}

			// None of the versions match
			callback(new Error('no-match'));
		} else {
			callback(new Error('not-found'));
		}
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