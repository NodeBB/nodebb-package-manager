'use strict';

const async = require('async');

const packages = require('../packages');
const nodebb = require('../nodebb');
const analytics = require('../analytics');

const mainController = module.exports;

mainController.index = function (req, res, next) {
	let versions;
	async.waterfall([
		function (next) {
			nodebb.getVersions().then(next).catch(err => next(err));
		},
		function (_versions, next) {
			versions = _versions;

			const selectedVersion = versions.includes(req.query.version) ?
				req.query.version :
				versions[0];
			packages.getPlugins(selectedVersion, next);
		},
	], (err, data) => {
		if (err) {
			return next(err);
		}
		res.render('index', {
			versions: versions,
			packages: data,
		});
	});
};



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
