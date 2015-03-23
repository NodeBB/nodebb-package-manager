'use strict';
/* globals require */

var express = require('express'),
	cronJob = require('cron').CronJob,
	winston = require('winston'),
	app = express(),
	// search = require('./lib/search'),
	packages = require('./lib/packages'),
	controllers = require('./lib/controllers');

require('./lib/routes')(app, controllers);

winston.info('NodeBB Package Manager - Initializing');

new cronJob('0 * * * *', packages.registry.sync, null, true);

app.listen(process.env.PORT || 3000);
console.log('NodeBB Package Manager - Ready');