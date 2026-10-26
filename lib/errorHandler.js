'use strict';


const ErrorHandler = module.exports;

ErrorHandler.respond = function (status, res) {
	const errorPayload = ErrorHandler.generate(status);

	res.status(status).json(errorPayload);
	return true;
};

ErrorHandler.handle = function (err, res, payload) {
	if (err) {
		res.status(500).json(ErrorHandler.generate(500, undefined, err.message));
	} else {
		res.status(200).json({
			code: 'ok',
			payload: payload || {},
		});
	}
};

ErrorHandler.generate = function (status, code, message, params) {
	// All arguments are optional
	const errorPayload = ErrorHandler.statusToCode(status);

	errorPayload.code = code || errorPayload.code;
	errorPayload.message = message || errorPayload.message;
	errorPayload.params = params || errorPayload.params;

	return errorPayload;
};

ErrorHandler.statusToCode = function (status) {
	const payload = {
		code: 'internal-server-error',
		message: 'An unexpected error was encountered while attempting to service your request.',
		params: {},
	};

	switch (status) {
		case 400:
			payload.code = 'bad-request';
			payload.message = 'Something was wrong with the request payload you passed in.';
			break;

		case 401:
			payload.code = 'not-authorised';
			payload.message = 'You are not authorised to make this call';
			break;

		case 404:
			payload.code = 'not-found';
			payload.message = 'Invalid API call';
			break;
	}

	return payload;
};
