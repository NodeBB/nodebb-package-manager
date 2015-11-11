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

module.exports = analyticsController;