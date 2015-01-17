global.self = {
	isWorker: true,
	postMessage: function (msg) {
		process.send(msg);
	},
	onmessage: function(){},
	onerror: function(){},
	addEventListener: function (eventName, cb) {
		if (eventName === 'message') {
			global.onmessage = global.self.onmessage = cb;
		} else if (eventName === 'error') {
			global.onerror = global.self.onerror = cb;
		}
	}
};

var postMessage = self.postMessage;

function importScripts() {
	// TODO: Don't call it importScripts
	// Deprecate Dependencies listing
	// Do it internally????????
	var scripts = [].slice.call(arguments);
	scripts.forEach(function(script) {
		if (/:\/\//.test(script)) {
			// ... ?????
		} else {
			// TODO: [Potentially]
			// Divine name from /.../{HERE}.js
			// Node.js cannot get remote files
			// Node.js -- probably best to use inline require() ...

		}
	});
}

process.on('message', function(msg) {

	if (typeof msg == 'string') {
		try {
			eval(msg);
		} catch(e) {
			// TODO: here
			console.log('Cannot eval script');
		}
		return;
	}

	var defs = msg.definitions;
	var isDeferred = false;
	var isAsync = false;
	var args = msg.args;

	if (defs) {
		// Initial definitions:
		for (var i in defs) {
			self[i] = defs[i];
		}
		return;
	}

	args.push(function() {
		// Callback function to be passed to operative method
		returnResult({
			args: [].slice.call(arguments)
		});
	});

	self.async = function() { // Async deprecated as of 0.2.0
		isAsync = true;
		return function() { returnResult({ args: [].slice.call(arguments) }); };
	};

	self.deferred = function() {
		isDeferred = true;
		var def = {};
		function fulfill(r) {
			returnResult({
				isDeferred: true,
				action: 'fulfill',
				args: [r]
			});
			return def;
		}
		function reject(r) {
			returnResult({
				isDeferred: true,
				action: 'reject',
				args: [r]
			});
		}
		def.fulfil = def.fulfill = fulfill;
		def.reject = reject;
		return def;
	};

	// Call actual operative method:
	var result = self[msg.method].apply(self, args);

	if (!isDeferred && !isAsync && result !== void 0) {
		// Deprecated direct-returning as of 0.2.0
		returnResult({
			args: [result]
		});
	}

	self.deferred = function() {
		throw new Error('Operative: deferred() called at odd time');
	};

	self.async = function() { // Async deprecated as of 0.2.0
		throw new Error('Operative: async() called at odd time');
	};

	function returnResult(res) {
		process.send({
			cmd: 'result',
			token: msg.token,
			result: res
		});
	}
});
