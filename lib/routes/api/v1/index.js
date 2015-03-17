"use strict";

var VERSION = '/api/v1/';

module.exports = function(app, controllers) {
	app.get(VERSION + 'plugins/:version?', controllers.plugins.get);
	app.put(VERSION + 'plugins/:package', controllers.plugins.update);
	app.get(VERSION + 'suggest', controllers.plugins.suggest);
};