'use strict';

const path = require('path');

const middleware = require.main.require('./lib/middleware');
const VERSION = '/api/v1/';

module.exports = function (app, controllers) {
	app.use((req, res, next) => {
		res.header('Access-Control-Allow-Origin', '*');
		next();
	});

	app.get(`${VERSION}plugins`, middleware.recordIP, controllers.plugins.list);
	app.post(`${VERSION}plugins`, controllers.plugins.rebuild);
	app.get(`${VERSION}plugins/:scope?/:package`, middleware.recordIP, middleware.handleScopedPackages, middleware.ensureValidPackage, controllers.plugins.get);
	app.put(`${VERSION}plugins/:scope?/:package`, middleware.recordIP, middleware.handleScopedPackages, controllers.plugins.update);
	app.get(`${VERSION}plugins/search`, middleware.recordIP, controllers.plugins.search);

	app.get(`${VERSION}plugins/:package/compatibility.png`, (req, res) => {
		const newPath = path.resolve(path.dirname(req.url), `${path.basename(req.url, '.png')}.svg`);
		res.redirect(newPath);
	});
	app.get(`${VERSION}plugins/:scope?/:package/compatibility.svg`, middleware.recordIP, middleware.handleScopedPackages, middleware.ensureValidPackage, controllers.plugins.getCompatibilityBadge);
	app.get(`${VERSION}suggest`, middleware.recordIP, controllers.plugins.suggest);

	app.get(`${VERSION}analytics/index`, controllers.analytics.index);
	app.get(`${VERSION}analytics/top/:period`, controllers.analytics.top);

	app.post(`${VERSION}plugin/usage`, controllers.plugins.usage);
};
