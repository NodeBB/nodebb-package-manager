var request = require('request'),
	winston = require('winston'),
	versionCache = require('lru-cache')({
		max: 1,
		maxAge: 1000*60*60*24		// only cache for one day
	}),
	NodeBB = {};

NodeBB.getVersions = function(callback) {
	if (versionCache.has('versions')) {
		return callback(null, versionCache.get('versions'));
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
					return versionObj.name.slice(1);
				});

			versionCache.set('versions', versions);
			callback(null, versions);
		} else {
			winston.warn('[nodebb] Could not retrieve versions from GitHub');
			callback(null, []);
		}
	});
};

module.exports = NodeBB;