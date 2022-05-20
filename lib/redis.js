'use strict';

const redis = require('redis');
const url = require('url');
const winston = require('winston');
const nconf = require('nconf');

let client;

if (nconf.get('REDISCLOUD_URL')) {
	const redisURL = url.parse(nconf.get('REDISCLOUD_URL'));
	client = redis.createClient(redisURL.port, redisURL.hostname, { no_ready_check: true });
	client.auth(redisURL.auth.split(':')[1]);
} else {
	client = redis.createClient('6379', '127.0.0.1', { no_ready_check: true });
}

if (nconf.get('REDISDB')) {
	winston.info(`[redis] Selecting database ${nconf.get('REDISDB')}`);
	client.select(nconf.get('REDISDB'));
}

module.exports = client;
