var promix = require('promix'),
	is_node = this === exports && typeof window === 'undefined',
	abstracted_request = is_node ? require('req' + 'uest') : require('./xhr'),
	error_statuses = require('./error-statuses');

function request(options) {
	var promise = promix.promise();

	function handler(error, response, body) {
		if (error) {
			return void promise.reject(error);
		}

		if (error_statuses.indexOf(response.statusCode) !== -1) {
			try {
				body = JSON.parse(body);
				body.status = response.statusCode;
				return void promise.reject(body);
			} catch(error) {
				return void promise.reject(error);
			}
		}


		try {
			return void promise.fulfill(JSON.parse(body));
		} catch(error) {
			return void promise.reject(error);
		}
	}

	if (options.url && options.url.indexOf('?') !== -1) {
		options.url = options.url.split('?');
		options.search = options.url.pop();
		options.url = options.url[0];
	}

	options.url = 'http://' + options.host + ':' + options.port + '/' + options.url;
	if (options.search) {
		options.url += '?' + options.search;
	}

	if (!options.body) {
		options.body = '';
	} else {
		options.body = JSON.stringify(options.body);
	}

	abstracted_request(options, handler);

	return promise;
}

module.exports = {
	request: request
};
