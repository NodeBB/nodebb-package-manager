var rdb = require('./redis'),
	errorHandler = require('./errorHandler'),

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

module.exports = middleware;