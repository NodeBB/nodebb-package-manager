"use strict";

var semver = require('semver');

var errorHandler = require('../errorHandler');
var Packages = require('../packages');

var prereleaseMatch = /-.+$/;

var plugins = module.exports;

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

plugins.getCompatibilityBadge = function(req, res) {
	Packages.getCompatibilityBadge(req.params.package, function(err, data) {
		if (err) {
			return errorHandler.handle(err, res, data);
		}

		var url = ['https://img.shields.io/badge/NodeBB%20', data.nbbVersion, '-compatible', '-brightgreen', '.png'];
		if (!data.compatible) {
			url[2] = '-out_of_date';
			url[3] = '-red';
		}

		res.redirect(url.join(''));
	});
};

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
	if (req.headers['x-github-event'] === 'ping') {
		return res.sendStatus(200);
	} else if (req.headers['x-github-event'] !== 'create' || req.body.ref_type !== 'tag') {
		return next();
	}

	// Send back a response instantly, otherwise GitHub gets impatient and closes the connection
	res.sendStatus(200);

	Packages.rebuild();
};

plugins.usage = function (req, res, next) {
	if (!req.body.id || !req.body.version || !Array.isArray(req.body.plugins)) {
		return res.status(500).send('invalid-data');
	}

	Packages.saveUsage(req.body, function (err) {
		if (err) {
			return res.status(500).send(err.message);
		}
		res.send('ok');
	});
};
