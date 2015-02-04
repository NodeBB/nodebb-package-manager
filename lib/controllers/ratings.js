"use strict";

var ratings = {},
	async = require('async'),
	search = require('./../search'),
	exec = require('child_process').exec,
	rdb = require('./../redis'),
	functions = require('./../functions'),
	ALLOWED_METHODS = ['offensive', 'exploit', 'approved', 'unapproved', 'unflagged'];





ratings.get = function(req, res) {
	if (!req.body.pkg || req.body.pkg.length < 3 || !req.user || !req.user.username) {
		return res.json(null, {
			hasFlagged: false,
			hasApproved: false
		});
	}

	ratings.getRatings(req.body.pkg, req.user.username, function(err, rating) {
		res.json(rating);
	});
};

ratings.getRatings = function(pkg, username, callback) {
	functions.getNodeBBVersion(function(err, version) {
		async.parallel({
			hasFlaggedAsOffensive: function(next) {
				rdb.sismember(pkg + ':exploit', username, next);
			},
			hasFlaggedAsExploit: function(next) {
				rdb.sismember(pkg + ':offensive', username, next);
			},
			hasApproved: function(next) {
				rdb.sismember(pkg + ':' + version + ':approved', username, next);
			}
		}, function(err, data) {
			callback(err, {
				hasApproved: parseInt(data.hasApproved, 10) === 1,
				hasFlagged: parseInt(data.hasFlaggedAsExploit, 10) === 1 || parseInt(data.hasFlaggedAsOffensive, 10) === 1
			});
		});	
	});
};

ratings.rate = function(req, res) {
	if (!req.body.type || !req.body.name || !req.body.method || !req.user || !req.user.username || ALLOWED_METHODS.indexOf(req.body.method) === -1) {
		return res.json({
			type: "error",
			message: "Invalid vote attempt."
		});
	}

	var pkg = req.body.type + req.body.name;

	var child = exec('npm config set registry="http://registry.npmjs.org/" & npm show ' + pkg + ' version', function(err, pkgVersion) {
		if (err) {
			return res.json({
				type: "error",
				message: "Package <strong>" + pkg + "</strong> was not found."
			});
		}

		pkgVersion = pkgVersion.replace(/\n/g, '');

		functions.getNodeBBVersion(function(err, version) {
			var type = (req.body.method === 'offensive' || req.body.method === 'exploit') ? 'flagged' : req.body.method,
				username = req.user.username;
				
			rdb.sadd('users', username);
			
			var text,
				date = Date.now();

			if (type === 'unflagged') {
				rdb.srem(pkg + ':exploit', username);
				rdb.srem(pkg + ':offensive', username);
				text = date + '|' + username + ' has unflagged <strong>' + pkg + '</strong>';
			} else if (type === 'unapproved') {
				rdb.srem(pkg + ':' + version + ':approved', username);
				text = date + '|' + username + ' has unapproved <strong>' + pkg + '</strong> for v' + version;
			} else if (type === 'approved') {
				rdb.sadd(pkg + ':' + version + ':approved', username);
				text = date + '|' + username + ' has approved <strong>' + pkg + '</strong> for v' + version;
			} else if (type === 'flagged') {
				rdb.sadd(pkg + ':' + req.body.method, username);
				text = date + '|' + username + ' has flagged <strong>' + pkg + '</strong>';
			}

			rdb.lpush('activity', text, function(err) {
				if (!err) {
					rdb.ltrim('activity', 0, 19);
				}
			});

			var sendData = {
				type: type === 'flagged' ? 'warning': "success",
				message: "Successfully <strong>" + type + "</strong> package <strong>" + pkg + "</strong> for v" + version
			};

			if (type === 'approved') {
				// conscious decision to award only positve actions
				rdb.sismember(pkg + ':' + version, username, function(err, result) {
					if (err) {
						throw new Error(err);
					}

					if (parseInt(result, 10) !== 1) {
						rdb.sadd(pkg + ':' + version, username);
						rdb.hincrby('user:' + username, 'points', 10, function(err, score) {
							rdb.zadd('leaderboard', score, username);	
						});
						
						rdb.hincrby(pkg + ':' + version + ':knownVersions', pkgVersion, 1);

						sendData.awarded = 10;
						res.json(sendData);
					} else {
						res.json(sendData);
					}
				});
			} else {
				res.json(sendData);
			}
		});

		
	});
};


module.exports = ratings;