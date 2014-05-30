var acolyte = require('./index'),
	sorcerer = require('sorcerer'),
	http = require('http'),
	server = http.createServer().listen(2050);

sorcerer.attach(server);

var wizards = [
	{ id: 1, name: 'harry' },
	{ id: 2, name: 'gandalf' },
	{ id: 3, name: 'voldemort' },
	{ id: 4, name: 'dumbledore' }
];

var familiar = {
	id: 123,
	species: 'owl',
	name: 'hedwig'
};

var colors = [ ];

sorcerer.link('wizards', {
	get: function(req, res, callback) {
		return void callback(null, wizards);
	}
}).link(':wizard', {
	get: function(req, res, callback) {
		var wizard,
			id = +req.parameters.wizard,
			index = wizards.length;

		while (index--) {
			wizard = wizards[index];
			if (wizard.id === id) {
				return void callback(null, wizard);
			}
		}

		return void callback(new Error('not found'));
	}
}).link('familiar', {
	get: function get(req, res, callback) {
		return void callback(null, familiar);
	},
	put: function put(req, res, callback) {
		var body = req.body,
			key;

		for (key in body) {
			familiar[key] = body[key];
		}

		console.log('familiar is now:');
		console.log(familiar);

		return void callback(null, familiar);
	}
}).link('colors', {
	get: function(req, res, callback) {
		return void callback(null, colors);
	},
	post: function(req, res, callback) {
		colors.push(req.body);
		return void callback(null, req.body);
	}
}).link(':color', {
	get: function(req, res, callback) {
		var id = +req.parameters.color,
			index = colors.length,
			color;

		while (index--) {
			color = colors[index];
			if (color.id === id) {
				return void callback(null, color);
			}
		}

		return void callback(new Error('color ' + id + ' not found'));
	},
	delete: function(req, res, callback) {
		var id = +req.parameters.color,
			index = colors.length,
			color;

		while (index--) {
			color = colors[index];
			if (color.id === id) {
				colors.splice(index, 1);
				return void callback(null, {
					message: 'ok'
				});
			}
		}

		return void callback(new Error('color ' + id + ' not found'));
	}
});

acolyte.config({
	host: 'localhost',
	port: 2050
});

/*
acolyte.wizards.find(1).set('name', 'barry botter');

acolyte.wizards.where({
	name: 'barry botter'
}).familiar.species.specialist.university.then(function(university) {
	console.log(university);
	console.log('============');
});
*/

var owl_promise = acolyte.wizards.findWhere('name', 'harry').familiar.set('name', 'sonara');

owl_promise.then(function(result) {
	console.log('complete');
	console.log(result);
}, function(error) {
	console.log('there was an error');
	console.log(error);
	console.log(error.stack);
});

owl_promise.colors.push({
	id: 1,
	name: 'black'
}).then(function(result) {
	console.log('color create result:');
	console.log(result);
});

setTimeout(function() {
	owl_promise.colors.find(1).then(function(result) {
		console.log('color read result:');
		console.log(result);
	});
}, 2000);

setTimeout(function() {
	owl_promise.colors.find(1).delete().then(function(result) {
		console.log('color delete result:');
		console.log(result);
	}, function(error) {
		console.log('there was an error during delete:');
		console.log(error);
	});
}, 3000);

setTimeout(function() {
	owl_promise.colors.then(function(results) {
		console.log('and we end up with:');
		console.log(results);
	});
}, 4000);

