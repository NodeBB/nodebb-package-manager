'use strict';

const analytics = require('../analytics');

const analyticsController = module.exports;

analyticsController.index = function (req, res, next) {
	analytics.summary.index((err, data) => {
		if (err) {
			return next(err);
		}
		res.json(data);
	});
};

analyticsController.top = function (req, res, next) {
	const periods = ['week', 'month', 'all'];
	if (!periods.includes(req.params.period)) {
		return next();
	}

	analytics.summary.top(req.params.period, (err, data) => {
		if (err) {
			return next(err);
		}
		res.json(data);
	});
};
