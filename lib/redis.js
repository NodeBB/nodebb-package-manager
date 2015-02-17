'use strict';
/* globals require, process, module */

var redis = require('redis'),
	url = require('url'),
	winston = require('winston'),
	client;

if (process.env.REDISCLOUD_URL) {
	var redisURL = url.parse(process.env.REDISCLOUD_URL);
	client = redis.createClient(redisURL.port, redisURL.hostname, {no_ready_check: true});
	client.auth(redisURL.auth.split(':')[1]);
} else {
	client = redis.createClient('6379', '127.0.0.1', {no_ready_check: true});
}

if (process.env.REDISDB) {
	winston.info('[redis] Selecting database ' + process.env.REDISDB);
	client.select(process.env.REDISDB);
}

module.exports = client;