var error_statuses = require('./error-statuses');

function xhr(parameters, callback) {
	var request = new XMLHttpRequest(),
		body = parameters.body || { },
		url = parameters.url,
		method = parameters.method ? parameters.method.toUpperCase() : 'GET';

	function success(event) {
		request.removeEventListener('load', success);
		request.removeEventListener('error', failure);

		if (error_statuses.indexOf(request.status) !== -1) {
			event.error = new Error(request.responseText);
			return failure(event);
		}

		return void callback(null, request, request.response);
	}

	function failure(event) {
		var error = event.error || new Error('XHR Error');

		request.removeEventListener('load', success);
		request.removeEventListener('error', failure);

		return void callback(error);
	}
		
	if (typeof body !== 'string') {
		body = JSON.stringify(body);
	}

	request.addEventListener('load', success, false);
	request.addEventListener('error', failure, false);

	request.open(method, url, true);

	request.setRequestHeader('Accept', 'application/json,text/plain,text/css');

	request.send(body || '');
}




module.exports = xhr;
