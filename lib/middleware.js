var rdb = require('./redis'),
	errorHandler = require('./errorHandler'),
	winston = require('winston'),

	isValidPackage = /^(?:@[\w\-_]+\/)?nodebb-(plugin|theme|widget|rewards)/,
	middleware = {};

middleware.ensureValidPackage = function(req, res, next) {
	const package = `${req.params.scope ? req.params.scope + '/' : ''}${req.params.package}`;
	if (!isValidPackage.test(package)) {
		return errorHandler.respond(400, res);
	}

	rdb.exists('package:' + package, function(err, exists) {
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