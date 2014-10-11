"use strict";

var templates = require('templates.js'),
	async = require('async'),
	express = require('express'),
	path = require('path'),
	passport = require('passport'),
	githubStrategy = require('passport-github').Strategy,
	session = require('express-session'),
  	RedisStore = require('connect-redis')(session),
  	rdb = require('./../redis'),
	app,
	middleware = {};

var GITHUB_CLIENT_ID = "83736149379ee84b8c0a";
var GITHUB_CLIENT_SECRET = "2dc9bda3928ee6291d04a56ba136977526494028";


middleware.processRender = function(req, res, next) {
	// res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
	var render = res.render;
	res.render = function(template, options, fn) {
		var self = this,
			options = options || {},
			req = this.req,
			app = req.app,
			defaultFn = function(err, str){
				if (err) {
					return req.next(err);
				}

				self.send(str);
			};

		if ('function' === typeof options) {
			fn = options, options = {};
		}

		if ('function' !== typeof fn) {
			fn = defaultFn;
		}

		if (res.locals.isAPI) {
			return res.json(options);
		}

		render.call(self, template, options, function(err, str) {
			if (res.locals.footer) {
				str = str + res.locals.footer;
			}

			if (res.locals.header) {
				str = res.locals.header + str;
			}

			fn(err, str);
		});
	};

	next();
};

middleware.renderPage = function(req, res, next) {
	var username = req.user ? req.user.username : 0;

	async.parallel([
		function(next) {
			app.render('header', {username: username, csrf: res.locals.csrf_token}, function(err, template) {
				res.locals.header = template;
				next(err);
			});
		},
		function(next) {
			app.render('footer', {username: username, csrf: res.locals.csrf_token}, function(err, template) {
				res.locals.footer = template;
				next(err);
			});
		}
	], function(err) {
		next(err);
	});
};

module.exports = function(_app) {
	app = _app;

	passport.serializeUser(function(user, done) {
		done(null, user);
	});

	passport.deserializeUser(function(obj, done) {
		done(null, obj);
	});

	passport.use(new githubStrategy({
		clientID: GITHUB_CLIENT_ID,
		clientSecret: GITHUB_CLIENT_SECRET,
		callbackURL: process.env.PORT ? 'http://npm.aws.af.cm/auth/github/callback' : "http://127.0.0.1:3000/auth/github/callback"
	},
	function(accessToken, refreshToken, profile, done) {
		process.nextTick(function () {
			return done(null, profile);
		});
	}));


	app.configure(function() {
		app.engine('tpl', templates.__express);
		app.set('view engine', 'tpl');
		app.set('views', './views');

		app.use(express.bodyParser());
		app.use(express.cookieParser());

		app.use(express.session({
			store: new RedisStore({
				client: rdb,
				ttl: 60 * 60 * 24 * 7
			}),
			secret: '92j72hnjxw09',
			key: 'express.sid',
			cookie: {
				maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days
			}
		}));

		app.use(passport.initialize());
		app.use(passport.session());

		app.use(express.csrf());

		app.use(function (req, res, next) {
			res.locals.csrf_token = req.csrfToken();
			next();
		});


		app.use(middleware.processRender);
		app.use('/', app.router);

		app.use('/', express.static(path.join(__dirname, '../../', 'public'), {
			maxAge: app.enabled('cache') ? 5184000000 : 0
		}));
	});

	app.get('/auth/github', passport.authenticate('github'));
	app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/' }), function(req, res) {
		res.redirect('/');
	});

	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});

	return middleware;
};