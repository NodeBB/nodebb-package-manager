"use strict";

var middleware = require.main.require('./lib/middleware'),

	express = require('express'),
	path = require('path');

module.exports = function(app, controllers) {
	// Vendor modules via bower
	app.use('/vendor', express.static(path.join(__dirname, '../../bower_components')));
	app.use('/vendor/templates.js', express.static(path.join(__dirname, '../../node_modules/templates.js/lib')));

	app.get('/stats', function(req, res) {
		res.render('stats', {
			serverTime: new Date().toISOString()
		});
	});
};