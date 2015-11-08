'use strict';
/* globals require */

var express = require('express'),
	cronJob = require('cron').CronJob,
	winston = require('winston'),
	templates = require('templates.js'),
	rdb = require('./lib/redis'),
	app = express(),
	packages = require('./lib/packages'),
	analytics = require('./lib/analytics'),
	controllers = require('./lib/controllers'),

	requiredEnv = ['GITHUB_TOKEN', 'GITHUB_USER_AGENT'];

if (!requiredEnv.every(function(key) {
	return process.env.hasOwnProperty(key);
})) {
	winston.error('[init] Required environment variables not found, please consult launch.template file');
	return process.exit(1);
}

require('./lib/routes')(app, controllers);

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
	colorize: true,
	level: process.env.NODE_ENV === 'production' ? 'info' : 'verbose'
});

winston.info('NodeBB Package Manager - Initializing');

new cronJob('0 * * * *', packages.registry.sync, null, true);

analytics.init();

// Templates.js
app.engine('tpl', templates.__express);
app.set('view engine', 'tpl');
app.set('views', 'views');

app.listen(process.env.PORT || 3000);

winston.info('NodeBB Package Manager - Ready');

// Check packaged sorted set. If missing, conduct initial sync
packages.registry.init(function(err) {
	if (err) {
		winston.error('[init] Could not initialise registry.');
		winston.error('[init] ' + err.message);
		return process.exit(1);
	}

	rdb.zcard('packages', function(err, numPackages) {
		if (numPackages === 0) {
			winston.info('[init] No packages detected in database, running initial sync');
			packages.registry.sync(true);
		} else {
			winston.info('[init] Managing ' + numPackages + ' packages');
		}
	});
});
