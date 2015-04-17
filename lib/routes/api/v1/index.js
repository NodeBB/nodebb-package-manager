"use strict";

var middleware = require.main.require('./lib/middleware'),
	VERSION = '/api/v1/';

module.exports = function(app, controllers) {
	app.use(function(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		next();
	});

	app.get(VERSION + 'plugins', controllers.plugins.list);
	app.get(VERSION + 'plugins/:package', middleware.ensureValidPackage, controllers.plugins.get);
	app.put(VERSION + 'plugins/:package', controllers.plugins.update);
	app.get(VERSION + 'suggest', controllers.plugins.suggest);
};