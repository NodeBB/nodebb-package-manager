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
		if (err) {
			switch(err.message) {
				case 'nodebb-version-required':
					res.status(400).json({
						status: 'error',
						code: err.message,
						message: 'The required parameter "version" was not sent. This value is the NodeBB version that you are checking this package against.'
					});
					break;

				case 'not-found':
					res.status(404).json({
						status: 'error',
						code: err.message,
						message: 'A package by the name of `' + req.query.name + '` could not be found in the NodeBB Package Manager'
					});
					break;

				case 'no-match':
					res.status(200).json({
						status: 'ok',
						version: 'latest',
						code: err.message,
						message: 'No suggested package version was supplied by the plugin author, be cautious when installing the latest package version'
					});
					break;

				default:
					res.status(500).json({
						status: 'error',
						code: 'unknown-error',
						message: 'An unknown error occured while searching for a suggested package version'
					});
					break;
			}
		} else {
			res.status(200).json({
				status: 'ok',
				version: version,
				code: 'match-found',
				message: 'The plugin author suggests that you install v' + version + ' for your copy of NodeBB v' + req.query.version
			});
		}
	})
};

module.exports = plugins;