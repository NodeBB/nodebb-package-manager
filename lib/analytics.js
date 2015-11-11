var cronJob = require('cron').CronJob,
	winston = require('winston'),
	async = require('async'),
	rdb = require('./redis'),
	nodebb = require('./nodebb'),

	Analytics = {
		data: {},
		summary: {}
	};

Analytics.init = function() {
	new cronJob('*/' + (process.env.ANALYTICS_PERSIST_FREQ || '10') + ' * * * * *', Analytics.flush, null, true);
	// new cronJob('0 0 * * *', Analytics.onDayEnd, null, true);
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

// Summarise all data from the past 24 hours and store in ":day" set
Analytics.onDayEnd = function() {

};

Analytics.summary = {};

Analytics.summary.index = function(callback) {
	var hour = new Date();
	hour.setHours(new Date().getHours(), 0, 0, 0);

	async.waterfall([
		// async.apply(nodebb.getVersions),
		function(/*versions, */next) {
			var versions = ['0.9.0', '0.8.2'];  /* temp */
			async.map(versions, function(version, next) {
				// For each version, grab the last 24 hours of data
				var calls = [];
				for(x=23;x>=0;x--) {
					calls.push(async.apply(rdb.zscore.bind(rdb), 'analytics:list.' + version + ':hourly', hour - (1000*60*60*x)));
				}
				async.parallel(calls, next);
			}, function(err, stats) {
				// Replace nulls with zeroes
				stats = stats.map(function(stat) {
					return stat.map(function(value) {
						return parseInt(value, 10) || 0;
					});
				});

				// Add labels
				stats = stats.map(function(set, idx) {
					return {
						data: set,
						label: versions[idx]
					}
				});

				next(err, stats);
			});
		}
	], callback);
}

module.exports = Analytics;