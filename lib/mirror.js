var promix = require('promix'),
	requestor = require('./requestor');

require('harmony-reflect');

if (typeof Proxy !== 'function') {
	throw new Error('An ES6-compliant Proxy constructor is necessary for Acolyte!');
}

function percentageInCommon(source, target) {
	var found_count = 0;

	source.forEach(function each(item) {
		if (target.indexOf(item) !== -1) {
			found_count++;
		}
	});

	return found_count / source.length;
}

function ensureAttributes(args) {
	var attributes = args[0];

	if (typeof attributes === 'string') {
		attributes = { };
		attributes[args[0]] = args[1];
	}

	return attributes;
}

function serialize(attributes) {
	var key,
		result = '',
		attribute;

	var primitives = [
		'string',
		'number',
		'boolean'
	];

	for (key in attributes) {
		attribute = attributes[key];
		if (primitives.indexOf(typeof attribute) !== -1) {
			result += key + '=' + attribute + '&';
		}
	}

	return result.slice(0, -1);
}

function isArray(array) {
	return Object.prototype.toString.call(array) === '[object Array]';
}


function Mirror(params) {
	this.__chain = promix.chain();

	if (!params) {
		params = { };
	}

	if (params.parent) {
		this.__parent = params.parent;
		this.__chain.and(params.parent.__promise).as('parent');
	} else {
		this.__parent = null;
	}

	if (params.key) {
		this.__key = params.key;
		this.__chain.and(params.key).as('key');
	} else {
		this.__key = null;
	}

	if (params.url) {
		this.__url = params.url;
	}

	if (params.method) {
		this.__method = params.method;
	}

	if (params.body) {
		this.__body = params.body;
	}

	this.__nested = params.nested;

	this.__access_promise = promix.promise();
	this.__chain.and(this.__access_promise);

	this.__chain.then(this.__dispatch).bind(this);
	this.__chain.otherwise(this.__fail);

	this.__promise = promix.promise();

	this.__stamp = Math.random().toString(16).slice(3);

	return new Proxy(this, {
		get: function(target, key) {
			if (target[key] !== undefined) {
				return target[key];
			}

			target.__access_promise.fulfill(true);

			return new Mirror({
				parent: target,
				key: key
			});
		}
	});
}

Mirror.prototype = {
	__config: {
		host: 'localhost',
		port: 80
	},
	__promise: null,
	__url: null,
	__key: null,
	__parent: null,
	__aborted: false,
	__method: 'get',
	__body: null
};

Mirror.prototype.config = function config(options) {
	if (options.port) {
		this.__config.port = options.port;
	}
	if (options.host) {
		this.__config.host = options.host;
	}
	if (options.use_ssl !== undefined) {
		this.__config.use_ssl = options.use_ssl;
	}
};

Mirror.prototype.__navigate = function navigate(links, target) {
	var target_parts,
		link_parts,
		key,
		link,
		tail,
		prefix;

	if (typeof target !== 'string') {
		target = '' + target;
	}

	if (target.indexOf('?') !== -1) {
		target = target.split('?')[0];
	}

	target_parts = target.replace(/[\s_:.-]/g, ' ').split(' ');

	// TODO
	// make this smarter
	for (key in links) {
		link_parts = key.replace(/[\s_:.-]/g, ' ').split(' ');
		if (percentageInCommon(target_parts, link_parts) > 0.5) {
			return key;
		}
	}

	if (links[target] !== undefined) {
		return links[target].href;
	}

	if (this.__nested) {
		if (links.item) {
			return links.item.href.replace(/\/[\w+]$/, target);
		}

		if (links.self) {
			for (key in links) {
				link = links[key];
				link_parts = link.href.split('/');
				tail = link_parts.pop();
				prefix = link_parts.join('/');

				if (prefix === links.self.href && tail[0] === ':') {
					return link.href.replace(/([^\/]+)$/, target);
				}
			}
		}
	}

	return null;
};

Mirror.prototype.__dispatch = function dispatch(results) {
	var parent_results = results.parent,
		key = results.key,
		url;

	if (parent_results) {
		url = this.__navigate(parent_results.links, key);
	} else {
		url = '/';
	}

	if (!url) {
		this.__promise.reject(new Error('key ' + key + ' not found'));
		return;
	}

	this.__url = url;

	this.__chain.and(requestor.request({
		host: this.__config.host,
		port: this.__config.port,
		method: this.__method,
		body: this.__body,
		url: url
	})).as('request');

	this.__chain.then(function interstitial(results) {
		var request = results.request;

		this.__promise.fulfill(request);
	}).bind(this);
};

Mirror.prototype.__fail = function fail(error) {
	return this.__promise.reject(error);
};

Mirror.prototype.__abort = function abort() {
	this.__aborted = true;
	this.__promise.fulfill();
	this.__chain.break();
};

Mirror.prototype.__release = function release(value) {
	this.__access_promise.fulfill(value);
	this.__access_promise = promix.promise();
};

Mirror.prototype.find = function find(id) {
	this.__release();

	return new Mirror({
		parent: this,
		key: id,
		nested: true
	});
};

Mirror.prototype.findWhere = function findWhere() {
	var attributes = ensureAttributes(arguments),
		key_promise = promix.promise(),
		keys = Object.keys(attributes),
		is_primary_key = keys.length === 1 && keys[0] === this.primary_key,
		filtered_mirror;

	function fulfiller(response) {
		var results = response.items,
			key;

		if (results === undefined) {
			for (key in attributes) {
				if (response[key] === undefined) {
					return void rejector(new Error('invalid response, needed something with the right attributes'));
				}
			}
		} else if (is_primary_key || !isArray(results)) {
			key_promise.fulfill(results);
		} else {
			key_promise.fulfill(results[0].id);
		}
	}

	function rejector(error) {
		key_promise.reject(error);
	}

	filtered_mirror = this.where(attributes);

	filtered_mirror.then(fulfiller, rejector);

	return new Mirror({
		parent: filtered_mirror,
		key: key_promise,
		nested: true
	});
};

Mirror.prototype.where = function where() {
	var attributes = ensureAttributes(arguments);

	this.__abort();

	return new Mirror({
		parent: this.__parent,
		key: promix.concat(this.__key, '?' + serialize(attributes))
	});
};

Mirror.prototype.get = function get(key) {
	var promise = promix.promise();

	this.promise.then(function interstitial(results) {
		if (results[key]) {
			promise.fulfill(results[key]);
		} else {
			promise.reject(new Error('property ' + key + ' not found'));
		}
	}, promise.reject);

	return promise;
};

Mirror.prototype.set = function set() {
	var body = ensureAttributes(arguments);

	return new Mirror({
		parent: this.__parent,
		key: this.__key,
		method: 'put',
		body: body
	});
};

Mirror.prototype.push = function push() {
	var body = ensureAttributes(arguments);

	return new Mirror({
		parent: this.__parent,
		key: this.__key,
		method: 'post',
		body: body
	});
};

Mirror.prototype.delete = function _delete() {
	return new Mirror({
		parent: this.__parent,
		key: this.__key,
		method: 'delete',
		nested: true
	});
};

Mirror.prototype.then = function then() {
	this.__release();
	return this.__promise.then.apply(this.__promise, arguments);
};


module.exports = Mirror;
