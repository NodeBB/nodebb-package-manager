"use strict";

function filter(pkg) {
	return {
		name: pkg.name,
		description: pkg.description,
		keywords: pkg.keywords,
		author: pkg.author,
		repository: pkg.repository,
		versions: pkg.versions
	};
}

var path = require('path'),
	npmSearch = require('npm-package-search'),
	search = npmSearch(path.join(__dirname, '/npm.json'), {filter: filter});


module.exports = search;