"use strict";

var middleware = require.main.require('./lib/middleware'),
	controllers = require('../controllers'),

	express = require('express'),
	path = require('path');

module.exports = function(app, controllers) {
	// Vendor modules via bower
	app.use('/vendor', express.static(path.join(__dirname, '../../bower_components')));
	app.use('/vendor/templates.js', express.static(path.join(__dirname, '../../node_modules/templates.js/lib')));

	app.get('/', function(req, res) { res.redirect('/stats'); });
	app.get('/stats', controllers.main.stats);
};