/* eslint-disable no-await-in-loop */

'use strict';

const util = require('util');

const DEFAULT_BATCH_SIZE = 100;

const sleep = util.promisify(setTimeout);

exports.processArray = async function (array, process, options) {
	options = options || {};

	if (!Array.isArray(array) || !array.length) {
		return;
	}
	if (typeof process !== 'function') {
		throw new Error('[[error:process-not-a-function]]');
	}

	const batch = options.batch || DEFAULT_BATCH_SIZE;
	let start = 0;
	if (process && process.constructor && process.constructor.name !== 'AsyncFunction') {
		process = util.promisify(process);
	}
	let iteration = 1;
	while (true) {
		const currentBatch = array.slice(start, start + batch);

		if (!currentBatch.length) {
			return;
		}
		if (iteration > 1 && options.interval) {
			await sleep(options.interval);
		}
		await process(currentBatch);

		start += batch;
		iteration += 1;
	}
};


