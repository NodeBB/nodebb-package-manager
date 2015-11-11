"use strict";

var async = require('async'),

	packages = require('../packages'),
	rdb = require('../redis'),

	mainController = {};

mainController.stats = function(req, res) {
	async.parallel({
		latest: async.apply(packages.getLatest)
	}, function(err, data) {
		if (err) {
			data.latest = [];
		}

		res.render('stats', {
			serverTime: new Date().toISOString(),
			latest: data.latest
		});
	})
};

module.exports = mainController;