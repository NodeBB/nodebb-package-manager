"use strict";

var functions = require('./../functions');

function renderHome(req, res, next) {
	functions.getNodeBBVersion(function(err, version) {
		res.render('index', {
			username: req.user ? req.user.username : '',
			csrf: res.locals.csrf_token,
			version: version
		});
	});	
}

function renderLeaderboard(req, res, next) {
	functions.getLeaderboard(function(err, leaderboard) {
		res.render('leaderboard', {users: leaderboard});
	});
}

function renderDiscover(req, res, next) {
	functions.getPackages(req.params.type || 'plugins', req.params.version || null, function(err, packages) {
		res.render('discover', packages);
	});
}

module.exports = function(app, middleware, controllers) {
	require('./api/v1')(app, middleware, controllers);

	app.get('/', middleware.renderPage, renderHome);
	app.get('/leaderboard', middleware.renderPage, renderLeaderboard);
	app.get('/discover/:type?', middleware.renderPage, renderDiscover);
};