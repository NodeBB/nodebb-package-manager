'use strict';

const semver = require('semver');

const errorHandler = require('../errorHandler');
const Packages = require('../packages');

const prereleaseMatch = /-.+$/;

const plugins = module.exports;

plugins.list = function (req, res) {
	req.query.version = (req.query.version || '').replace(prereleaseMatch, '');

	Packages.getPlugins(req.query.version, (err, data) => {
		res.json(data);
	});
};

plugins.get = (req, res) => {
	const { packageName } = res.locals;

	Packages.getPlugin(packageName, (err, data) => {
		errorHandler.handle(err, res, data);
	});
};

plugins.getCompatibilityBadge = async (req, res) => {
	const { packageName } = res.locals;

	try {
		const data = await Packages.getCompatibilityBadge(packageName);
		const url = ['https://img.shields.io/badge/NodeBB%20', data.nbbVersion, '-compatible', '-brightgreen', '.svg'];
		if (!data.compatible) {
			url[2] = '-out_of_date';
			url[3] = '-red';
		}

		res.redirect(url.join(''));
	} catch (err) {
		errorHandler.handle(err, res, {});
	}
};

plugins.suggest = function (req, res) {
	Packages.suggest(req.query.package, req.query.version, (err, version) => res.status(err ? 400 : 200).json(version));
};

plugins.update = function (req, res) {
	const { packageName } = res.locals;
	Packages.registry.update(packageName, (err) => {
		if (err) {
			return res.status(500).json({
				error: err.message,
			});
		}
		res.sendStatus(200);
		Packages.clearCaches(packageName);
	});
};

plugins.rebuild = function (req, res, next) {
	if (req.headers['x-github-event'] === 'ping') {
		return res.sendStatus(200);
	} else if (req.headers['x-github-event'] !== 'create' || req.body.ref_type !== 'tag') {
		return res.sendStatus(204);	// success, but no action.
	}

	// Send back a response instantly, otherwise GitHub gets impatient and closes the connection
	res.sendStatus(202);

	Packages.rebuild();
};

plugins.usage = function (req, res, next) {
	if (!req.body.id || !req.body.version || !Array.isArray(req.body.plugins)) {
		return res.status(500).send('invalid-data');
	}

	Packages.saveUsage(req.body, (err) => {
		if (err) {
			return res.status(500).send(err.message);
		}
		res.send('ok');
	});
};
