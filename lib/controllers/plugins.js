"use strict";

var plugins = {},
	functions = require('./../functions'),
	search = require('./../search');


plugins.get = function(req, res) {
	plugins.getPlugins(req.params.version, function(err, data) {
		res.json(data);
	});
};

plugins.getPlugins = function(version, callback) {
	search('nodebb-', function (err, data) {
		if (err) {
			throw new Error(err);
		}

		console.log(data);

		if (!version) {
			functions.getNodeBBVersion(function(err, version) {
				functions.getCompatibility(data, version, function(err, data) {
					callback(err, data);
				});
			});
		} else {
			functions.getCompatibility(data, version, function(err, data) {
				callback(err, data);
			});
		}		
	});
};


module.exports = plugins;