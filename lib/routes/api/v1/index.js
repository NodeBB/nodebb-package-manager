"use strict";

var middleware = require.main.require('./lib/middleware'),
	VERSION = '/api/v1/';

module.exports = function(app, controllers) {
	app.use(function(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		next();
	});

	app.get(VERSION + 'plugins', middleware.recordIP, controllers.plugins.list);
	app.post(VERSION + 'plugins', controllers.plugins.rebuild);
	app.get(VERSION + 'plugins/:package', middleware.recordIP, middleware.ensureValidPackage, controllers.plugins.get);
	app.put(VERSION + 'plugins/:package', middleware.recordIP, controllers.plugins.update);
	app.get(VERSION + 'plugins/:package/compatibility.png', middleware.recordIP, middleware.ensureValidPackage, controllers.plugins.getCompatibilityBadge);
	app.get(VERSION + 'suggest', middleware.recordIP, controllers.plugins.suggest);

	app.get(VERSION + 'analytics/index', controllers.analytics.index);
	app.get(VERSION + 'analytics/top/:period', controllers.analytics.top);
};