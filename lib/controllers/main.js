"use strict";

var async = require('async'),

	packages = require('../packages'),
	analytics = require('../analytics'),
	rdb = require('../redis'),

	mainController = {};

mainController.stats = function(req, res) {
	async.parallel({
		latest: async.apply(packages.getLatest),
		geo: async.apply(analytics.summary.geo),
		usage: async.apply(packages.getUsage),
	}, function(err, data) {
		if (err) {
			data.latest = [];
			data.geo = [];
		}

		res.render('stats', {
			serverTime: new Date().toISOString(),
			latest: data.latest,
			geo: data.geo,
			usage: data.usage,
		});
	})
};

module.exports = mainController;