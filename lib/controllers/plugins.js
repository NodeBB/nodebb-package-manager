"use strict";

var semver = require('semver');

var errorHandler = require('../errorHandler'),
	Packages = require('../packages');

var prereleaseMatch = /-.+$/,
	plugins = {};

plugins.list = function(req, res) {
	req.query.version = (req.query.version || '').replace(prereleaseMatch, '');

	Packages.getPlugins(req.query.version, function(err, data) {
		res.json(data);
	});
};

plugins.get = function(req, res) {
	Packages.getPlugin(req.params.package, function(err, data) {
		errorHandler.handle(err, res, data);
	});
}

plugins.suggest = function(req, res) {
	Packages.suggest(req.query.package, req.query.version, function(err, version) {
		return res.status(err ? 400 : 200).json(version);
	});
};

plugins.update = function(req, res) {
	Packages.registry.update(req.params.package, function(err) {
		if (err) {
			return res.status(500).json({
				error: err.message
			});
		} else {
			res.sendStatus(200);
			Packages.clearCaches(req.params.package);
		}
	});
};

plugins.rebuild = function(req, res, next) {
	if (req.headers['X-GitHub-Event'] === 'ping') {
		res.sendStatus(200);
	} else if (req.headers['X-GitHub-Event'] !== 'release') {
		return next();
	}

	Packages.rebuild(function(err) {
		res.sendStatus(err ? 500 : 200);
	});
};

module.exports = plugins;