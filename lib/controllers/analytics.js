"use strict";

var async = require('async'),

	errorHandler = require('../errorHandler'),
	analytics = require('../analytics'),
	rdb = require('../redis'),

	analyticsController = {};

analyticsController.index = function(req, res) {
	analytics.summary.index(function(err, data) {
		res.json(data);
	});
};

analyticsController.top = function(req, res, next) {
	var periods = ['week', 'month'];
	if (periods.indexOf(req.params.period) === -1) {
		return next();
	}

	analytics.summary.top(req.params.period, function(err, data) {
		res.json(data);
	});
};

module.exports = analyticsController;