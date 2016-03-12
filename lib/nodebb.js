var request = require('request'),
	winston = require('winston');

var NodeBB = {},
	_versionCache,
	_versionCacheTime;

NodeBB.getVersions = function(callback) {
	if (_versionCache && Date.now()-(1000*60*60*24) < _versionCacheTime) {
		return setImmediate(callback.bind(null, null, _versionCache));
	}

	request({
		url: 'https://api.github.com/repos/nodebb/nodebb/tags',
		json: true,
		headers: {
			Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
			'User-Agent': process.env.GITHUB_USER_AGENT
		}
	}, function(err, res, body) {
		if (err) {
			return callback(err);
		}

		if (res.statusCode === 200) {
			var versions = body.map(function(versionObj) {
					return versionObj.name.slice(1).replace(/-.+$/, '');
				}).filter(function(version, idx, versions) {
					// Remove duplicates (once prerelease suffices are stripped)
					return idx === versions.indexOf(version);
				});

			_versionCache = versions;
			_versionCacheTime = Date.now();
			callback(null, versions);
		} else {
			winston.warn('[nodebb] Could not retrieve versions from GitHub');
			callback(null, []);
		}
	});
};

module.exports = NodeBB;