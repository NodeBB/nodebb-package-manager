'use strict';

const async = require('async');

const packages = require('../packages');
const analytics = require('../analytics');

const mainController = module.exports;

mainController.stats = function (req, res) {
	async.parallel({
		latest: async.apply(packages.getLatest),
		geo: async.apply(analytics.summary.geo),
	}, (err, data) => {
		if (err) {
			data.latest = [];
			data.geo = [];
		}

		res.render('stats', {
			serverTime: new Date().toISOString(),
			latest: data.latest,
			geo: data.geo,
		});
	});
};

mainController.statsNodeBB = function (req, res, next) {
	packages.getUsage((err, data) => {
		if (err) {
			return next(err);
		}
		res.json(data);
	});
};
