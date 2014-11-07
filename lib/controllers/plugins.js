"use strict";

var plugins = {},
	Packages = require('../packages');

plugins.get = function(req, res) {
	Packages.getPlugins(req.params.version, function(err, data) {
		res.json(data);
	});
};

plugins.suggest = function(req, res) {
	Packages.suggest(req.query.package, req.query.version, function(err, version) {
		return res.status(err ? 400 : 200).json(version);
	});
};

module.exports = plugins;