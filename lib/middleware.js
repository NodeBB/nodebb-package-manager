'use strict';

const winston = require('winston');
const rdb = require('./redis');
const errorHandler = require('./errorHandler');

const isValidPackage = /^(?:@[\w\-_]+\/)?nodebb-(plugin|theme|widget|rewards)/;
const middleware = {};

middleware.handleScopedPackages = (req, res, next) => {
	res.locals.packageName = `${req.params.scope ? `${req.params.scope}/` : ''}${req.params.package}`;
	setImmediate(next);
};

middleware.ensureValidPackage = function (req, res, next) {
	const { packageName } = res.locals;

	if (!isValidPackage.test(packageName)) {
		return errorHandler.respond(400, res);
	}

	rdb.exists(`package:${packageName}`, (err, exists) => {
		if (err || !exists) {
			return errorHandler.respond(err ? 500 : 404, res);
		}
		next();
	});
};

middleware.recordIP = function (req, res, next) {
	winston.verbose(`Access from ${req.ip}`);
	rdb.zadd('ip:recent', Date.now(), req.ip, next);
};

module.exports = middleware;
