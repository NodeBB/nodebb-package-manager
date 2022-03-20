var request = require('request');
var winston = require('winston');
var nconf = require('nconf');
var semver = require('semver');

var NodeBB = {},
	_versionCache,
	_versionCacheTime;

const versionsPerPage = 100;

NodeBB.getVersions = function(skipCache, callback) {
	if (arguments.length === 1) {
		callback = skipCache;
		skipCache = false;
	}

	if (_versionCache && Date.now()-(1000*60*60*24) < _versionCacheTime && !skipCache) {
		return setImmediate(callback.bind(null, null, _versionCache));
	}

	getVersionsRecursive(1, [], function (err, versions) {
		if (err) {
			winston.warn('[nodebb] Could not retrieve versions from GitHub');
			callback(null, []);
		}
		versions = versions.map(function (version) {
			return version.slice(1).replace(/-.+$/, '');
		}).filter(function(version, idx, versions) {
			// Remove duplicates (once prerelease suffices are stripped)
			return semver.valid(version) && idx === versions.indexOf(version);
		});
		_versionCache = versions;
		_versionCacheTime = Date.now();
		callback(null, versions);
	});
};

function getVersionsRecursive(page, allVersions, callback) {
	getPage(page, function (err, versions) {
		if (err) {
			return callback(err);
		}
		if (!versions || !versions.length || versions.length < versionsPerPage) {
			return callback(null, allVersions);
		}
		allVersions = allVersions.concat(versions);
		page += 1;
		getVersionsRecursive(page, allVersions, callback);
	});
}

function getPage(page, callback) {
	request({
		url: 'https://api.github.com/repos/nodebb/nodebb/tags?per_page=' + versionsPerPage + '&page=' + page,
		json: true,
		headers: {
			Authorization: 'Bearer ' + nconf.get('GITHUB_TOKEN'),
			'User-Agent': nconf.get('GITHUB_USER_AGENT')
		}
	}, function(err, res, body) {
		if (err) {
			return callback(err);
		}
		if (res.statusCode === 200) {
			var versions = body.map(function(versionObj) {
				return versionObj && versionObj.name;
			}).filter(Boolean);
			callback(null, versions);
		} else {
			winston.warn('[nodebb] Could not retrieve versions from GitHub ' + res.statusCode);
			callback(null, []);
		}
	});
}

module.exports = NodeBB;
