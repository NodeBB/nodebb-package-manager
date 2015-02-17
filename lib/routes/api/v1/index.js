"use strict";

var VERSION = '/api/v1/';

module.exports = function(app, middleware, controllers) {
	app.get(VERSION + 'themes', controllers.themes.get);
	app.get(VERSION + 'plugins', controllers.plugins.get);
	app.put(VERSION + 'plugins/:package', controllers.plugins.update);
	app.post(VERSION + 'rate/get', controllers.ratings.get);
	app.post(VERSION + 'rate', controllers.ratings.rate);
	app.get(VERSION + 'suggest', controllers.plugins.suggest);
};