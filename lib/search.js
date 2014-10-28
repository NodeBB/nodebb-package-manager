"use strict";

var filter = function (pkg) {
		if (isPackage.test(pkg.name)) {
			return {
				name: pkg.name,
				description: pkg.description,
				keywords: pkg.keywords,
				author: pkg.author,
				repository: pkg.repository,
				versions: pkg.versions
			};
		} else {
			return null;
		}
	};

var path = require('path'),
	npmSearch = require('npm-package-search'),
	search = npmSearch(path.join(__dirname, '/npm.json'), {
		filter: filter,
		interval: 1000*60*60*24	// once a day
	}),
	isPackage = /^nodebb-/;


module.exports = search;