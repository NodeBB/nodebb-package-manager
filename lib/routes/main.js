"use strict";

var middleware = require.main.require('./lib/middleware'),
	controllers = require('../controllers'),

	express = require('express'),
	path = require('path');

module.exports = function(app, controllers) {
	// Vendor modules via bower
	app.use('/public', express.static(path.join(__dirname, '../../public')));
	app.use('/vendor', express.static(path.join(__dirname, '../../bower_components')));
	app.use('/vendor/templates.js', express.static(path.join(__dirname, '../../node_modules/templates.js/lib')));

	app.get('/', function(req, res) { res.redirect('/stats'); });
	app.get('/stats', controllers.main.stats);

	/**
	 * Uncomment this if you need to step through the OAuth flow to get a new access token for nbbpm.
	 *
	 * To kick off the flow, go here:
	 * https://github.com/login/oauth/authorize?client_id=7870b098b314d35f1943&allow_signup=false
	 */
	app.get('/gh-callback', async (req, res) => {
		const fetch = require('node-fetch');
		const code = req.query.code;

		res.type('text/plain').send(`code is ${code}`);
	})
};