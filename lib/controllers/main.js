"use strict";

var async = require('async'),

	errorHandler = require('../errorHandler'),
	rdb = require('../redis'),

	mainController = {};

mainController.stats = function(req, res) {
	res.render('stats', {
		serverTime: new Date().toISOString()
	});
};

module.exports = mainController;