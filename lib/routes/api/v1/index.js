"use strict";

var VERSION = '/api/v1/';

module.exports = function(app, controllers) {
	app.use(function(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		next();
	});

	app.get(VERSION + 'plugins/:version?', controllers.plugins.get);
	app.put(VERSION + 'plugins/:package', controllers.plugins.update);
	app.get(VERSION + 'suggest', controllers.plugins.suggest);
};