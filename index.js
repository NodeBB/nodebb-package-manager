'use strict';
/* globals require */

var express = require('express'),
	cronJob = require('cron').CronJob,
	winston = require('winston'),
	rdb = require('./lib/redis'),
	app = express(),
	packages = require('./lib/packages'),
	controllers = require('./lib/controllers'),

	requiredEnv = ['GITHUB_TOKEN', 'GITHUB_USER_AGENT'];

if (!requiredEnv.every(function(key) {
	return process.env.hasOwnProperty(key);
})) {
	winston.error('[init] Required environment variables not found, please consult launch.template file');
	return process.exit(1);
}

require('./lib/routes')(app, controllers);

winston.info('NodeBB Package Manager - Initializing');

new cronJob('0 0 * * *', function() {
	packages.registry.sync(true);	// Sync daily, instead
}, null, true);

app.listen(process.env.PORT || 3000);
winston.info('NodeBB Package Manager - Ready');

// Check packaged sorted set. If missing, conduct initial sync
rdb.zcard('packages', function(err, numPackages) {
	if (numPackages === 0) {
		winston.info('[init] No packages detected in database, running initial sync');
		packages.registry.sync(true);
	} else {
		winston.info('[init] Managing ' + numPackages + ' packages');
	}
});