'use strict';

const request = require('request-promise-native');
const winston = require('winston');
const nconf = require('nconf');
const semver = require('semver');

const NodeBB = {};
let _versionCache;
let _versionCacheTime;

const versionsPerPage = 100;

NodeBB.getVersions = async (skipCache = false) => {
	if (_versionCache && Date.now() - (1000 * 60 * 60 * 24) < _versionCacheTime && !skipCache) {
		return _versionCache;
	}

	try {
		let versions = await getVersionsRecursive(1, []);
		versions = versions
			.map(version => version.slice(1).replace(/-.+$/, ''))
			// Remove duplicates (once prerelease suffices are stripped)
			.filter((version, idx, versions) => semver.valid(version) && idx === versions.indexOf(version));

		_versionCache = versions;
		_versionCacheTime = Date.now();
		return versions;
	} catch (err) {
		winston.warn(`[nodebb] Could not retrieve versions from GitHub \n${err.stack}`);
		return [];
	}
};

async function getVersionsRecursive(page, allVersions) {
	const versions = await getPage(page);
	if (!versions || !versions.length || versions.length < versionsPerPage) {
		return allVersions;
	}
	allVersions = allVersions.concat(versions);
	page += 1;
	return getVersionsRecursive(page, allVersions);
}

async function getPage(page) {
	try {
		const body = await request({
			url: `https://api.github.com/repos/nodebb/nodebb/tags?per_page=${versionsPerPage}&page=${page}`,
			json: true,
			headers: {
				Authorization: `Bearer ${nconf.get('GITHUB_TOKEN')}`,
				'User-Agent': nconf.get('GITHUB_USER_AGENT'),
			},
		});

		const versions = body.map(versionObj => versionObj && versionObj.name).filter(Boolean);
		return versions;
	} catch (err) {
		winston.warn(`[nodebb] Could not retrieve versions page=${page} from GitHub \n${err.stack}`);
		return [];
	}
}

module.exports = NodeBB;
