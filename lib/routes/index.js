"use strict";

module.exports = function(app, controllers) {
	require('./api/v1')(app, controllers);
};