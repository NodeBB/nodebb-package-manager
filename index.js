'use strict';
/* globals require */

var express = require('express'),
	cronJob = require('cron').CronJob,
	winston = require('winston'),
	rdb = require('./lib/redis'),
	app = express(),
	// search = require('./lib/search'),
	packages = require('./lib/packages'),
	controllers = require('./lib/controllers');

require('./lib/routes')(app, controllers);

winston.info('NodeBB Package Manager - Initializing');

new cronJob('0 * * * *', packages.registry.sync, null, true);

app.listen(process.env.PORT || 3000);
winston.info('NodeBB Package Manager - Ready');

// Check packaged sorted set. If missing, conduct initial sync
rdb.zcard('packages', function(err, numPackages) {
	if (numPackages === 0) {
		winston.info('No packages detected in database, running initial sync');
		packages.registry.sync(true);
	}
});