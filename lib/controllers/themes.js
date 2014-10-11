"use strict";

var themes = {},
	functions = require('./../functions'),
	search = require('./../search');


themes.get = function(req, res) {
	themes.getThemes(req.params.version, function(err, data) {
		res.json(data);
	});
};

themes.getThemes = function(version, callback) {
	search('nodebb-theme-', function (err, data) {
		if (err) {
			throw new Error(err);
		}

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
module.exports = themes;