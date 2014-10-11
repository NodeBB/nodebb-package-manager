"use strict";

var VERSION = '/api/v1/';

module.exports = function(app, middleware, controllers) {
	app.get(VERSION + 'themes', controllers.themes.get);
	app.get(VERSION + 'plugins', controllers.plugins.get);
	app.post(VERSION + 'rate/get', controllers.ratings.get);
	app.post(VERSION + 'rate', controllers.ratings.rate);
};