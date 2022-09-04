'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cronJob = require('cron').CronJob;
const winston = require('winston');
const templates = require('templates.js');
const path = require('path');

const nconf = require('nconf');

nconf.env().file({
	file: path.join(__dirname, '/config.json'),
});

const rdb = require('./lib/redis');

const app = express();
const packages = require('./lib/packages');
const analytics = require('./lib/analytics');
const controllers = require('./lib/controllers');

const requiredEnv = ['GITHUB_TOKEN', 'GITHUB_USER_AGENT'];

if (!requiredEnv.every((key) => {
	if (process.env.hasOwnProperty(key)) {
		nconf.set(key, process.env[key]);
	}

	return !!nconf.get(key);
})) {
	winston.error('[init] Required environment variables not found, please consult launch.template file');
	process.exit(1);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
require('./lib/routes')(app, controllers);

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
	colorize: true,
	level: process.env.NODE_ENV === 'production' ? 'info' : 'verbose',
});

winston.info('NodeBB Package Manager - Initializing');

new cronJob('*/30 * * * *', packages.registry.sync, null, true);
new cronJob('0 0 * * *', packages.cleanUpUsage, null, true);

analytics.init();

// Templates.js
app.engine('tpl', templates.__express);
app.set('view engine', 'tpl');
app.set('views', 'views');
app.enable('trust proxy');

app.listen(nconf.get('PORT') || 3000);

winston.info('NodeBB Package Manager - Ready');

// Check packaged sorted set. If missing, conduct initial sync
// eslint-disable-next-line handle-callback-err
rdb.zcard('packages', (err, numPackages) => {
	if (numPackages === 0) {
		winston.info('[init] No packages detected in database, running initial sync');
		packages.registry.sync();
	} else {
		winston.info(`[init] Managing ${numPackages} packages`);
	}
});
