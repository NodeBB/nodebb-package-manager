"use strict";

var functions = {},
	async = require('async'),
	rdb = require('./redis');

functions.getNodeBBVersion = function(callback) {
	rdb.get('nodebb:version', function(err, version) {
		if (version) {
			return callback(err, version);
		}

		var request = require('request'),
			options = {
				url: 'https://api.github.com/repos/NodeBB/NodeBB/tags',
				headers: {
					'User-Agent': 'request'
				}
			};

		request(options, function(err, response, body) {
			if (!err && response.statusCode === 200) {
				var releases = JSON.parse(response.body),
					version = releases[0].name.slice(1);

				rdb.set('nodebb:version', version);
				rdb.expire('nodebb:version', 86400);

				callback(null, version);
			} else {
				callback(err, false);
			}
		});
	});
};

functions.getCompatibility = function(pkgs, version, callback) {
	var data = [];

	async.each(pkgs, function(pkg, next) {
		async.parallel({
			markedExploit: function(next) {
				rdb.smembers(pkg.name + ':exploit', next);
			},
			markedOffensive: function(next) {
				rdb.smembers(pkg.name + ':offensive', next);
			},
			approved: function(next) {
				rdb.smembers(pkg.name + ':' + version + ':approved', next);
			},
			knownVersions: function(next) {
				rdb.hgetall(pkg.name + ':' + version + ':knownVersions',  next);
			}
		}, function(err, properties) {
			pkg[version] = properties;
			pkg.tags = [];

			for(var key in pkg.keywords) {
				if (pkg.keywords.hasOwnProperty(key)) {
					pkg.tags.push({name: pkg.keywords[key]});
				}
			}

			data.push(pkg);
			next(err);
		});
	}, function(err) {
		callback(err, data);
	});
};

functions.getLeaderboard = function(callback) {
	var users = [];
	rdb.zrevrange('leaderboard', 0, 99, 'WITHSCORES', function(err, scores) {
		for (var i = 0, ii = scores.length; i < ii; i += 2) {
			users.push({
				username: scores[i],
				score: scores[i+1]
			});
		}

		callback(err, users);
	});
};

functions.getPackages = function(type, version, callback) {
	if (type === 'plugins') {
		require('./controllers/plugins').getPlugins(version, function(err, data) {
			var returnData = {
				packages: data,
				type: type,
				total: data.length
			};

			callback(err, returnData);
		});
	} else {
		require('./controllers/themes').getThemes(version, function(err, data) {
			var returnData = {
				packages: data,
				type: type,
				total: data.length
			};

			callback(err, returnData);
		});
	}
};

module.exports = functions;