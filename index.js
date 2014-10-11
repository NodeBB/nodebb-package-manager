"use strict";

var express = require('express'),
	app = express(),
	search = require('./lib/search'),
	middleware = require('./lib/middleware')(app),
	controllers = require('./lib/controllers');


require('./lib/routes')(app, middleware, controllers);

console.log('NodeBB Package Manager - Initializing');

search('nodebb-', function (err, data) {
	if (err) {
		throw new Error(err);
	}

	app.listen(process.env.PORT || 3000);
	console.log('NodeBB Package Manager - Ready');
});