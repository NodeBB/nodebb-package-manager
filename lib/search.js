"use strict";

var path = require('path'),
	npmSearch = require('npm-package-search'),
	search = npmSearch(path.join(__dirname, '/npm.json'));
	

module.exports = search;