var cronJob = require('cron').CronJob,
	winston = require('winston'),
	rdb = require('./redis'),
	Analytics = {
		data: {}
	};

Analytics.init = function() {
	new cronJob('*/' + (process.env.ANALYTICS_PERSIST_FREQ || '10') + ' * * * * *', Analytics.flush, null, true);
};

Analytics.incr = function(key, by) {
	Analytics.data[key] = (Analytics.data[key] || 0) + parseInt(by, 10);
	return true;
};

// Flushes the collected data to the database and resets all counters
Analytics.flush = function() {
	winston.verbose('[analytics.flush] Starting flush');
	var multi = rdb.multi(),
		hour = new Date();

	// Reset timestamp to the current hour
	hour.setHours(hour.getHours(), 0, 0, 0);

	for(var key in Analytics.data) {
		winston.verbose('[analytics.flush] Persisting ' + key + ', value: ' + Analytics.data[key]);
		multi.zincrby('analytics:' + key, Analytics.data[key], hour.getTime());
	}

	multi.exec(function(err) {
		// Reset counters
		for(var key in Analytics.data) {
			delete Analytics.data[key];
		}
		winston.verbose('[analytics.flush] Flush complete');
	});
};

module.exports = Analytics;