'use strict';
/* globals require, process, module */

var redis = require('redis'),
	url = require('url'),
	winston = require('winston'),
	nconf = require('nconf'),
	client;

if (nconf.get('REDISCLOUD_URL')) {
	var redisURL = url.parse(nconf.get('REDISCLOUD_URL'));
	client = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
	client.auth(redisURL.auth.split(':')[1]);
} else {
	client = redis.createClient('6379', '127.0.0.1', {no_ready_check: true});
}

if (nconf.get('REDISDB')) {
	winston.info('[redis] Selecting database ' + nconf.get('REDISDB'));
	client.select(nconf.get('REDISDB'));
}

module.exports = client;