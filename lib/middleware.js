var rdb = require('./redis'),
	errorHandler = require('./errorHandler'),
	winston = require('winston'),

	isValidPackage = /^nodebb-(plugin|theme|widget|rewards)/,
	middleware = {};

middleware.ensureValidPackage = function(req, res, next) {
	if (!isValidPackage.test(req.params.package)) {
		return errorHandler.respond(400, res);
	}

	rdb.exists('package:' + req.params.package, function(err, exists) {
		if (err || !exists) {
			return errorHandler.respond(err ? 500 : 404, res);
		} else {
			next();
		}
	});
};

middleware.recordIP = function(req, res, next) {
	winston.verbose('Access from ' + req.ip);
	rdb.zadd('ip:recent', Date.now(), req.ip, next);
};

module.exports = middleware;