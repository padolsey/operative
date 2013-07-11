/**
 * Operative
 * ---
 * Operative is a small JS utility for seamlessly creating Web Worker scripts.
 * ---
 * @author James Padolsey http://james.padolsey.com
 * @repo http://github.com/padolsey/operative
 * @version 0.0.1
 */
window.operative = (function() {

	var slice = [].slice;
	var hasOwn = {}.hasOwnProperty;

	var URL = window.URL || window.webkitURL;
	var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;

	operative.hasWorkerSupport = !!( URL && window.Worker && (window.Blob || BlobBuilder) );

	/**
	 * Operative: Exposed Operative Constructor
	 * @param {Object} module Object containing methods/properties
	 */
	function Operative(module) {

		var _self = this;

		module.get = module.get || function(prop) {
			return this[prop];
		};

		module.set = module.set || function(prop, value) {
			return this[prop] = value;
		};

		this.curToken = 0;
		this.isDestroyed = false;

		this.module = module;
		this.dataProperties = {};

		this.api = {};
		this.callbacks = {};

		if (operative.hasWorkerSupport) {
			this._setupWorker();
		} else {
			this._setupFallback();
		}

		for (var methodName in module) {
			if (hasOwn.call(module, methodName)) {
				this._createExposedMethod(methodName);
			}
		}

		this.api.__operative__ = this;

		// Provide the instance's destroy method on the exposed API:
		this.api.destroy = function() {
			return _self.destroy();
		};

		return this.api;
	}

	Operative.prototype = {

		_buildWorkerScript: function() {

			var script = [];
			var module = this.module;
			var dataProperties = this.dataProperties;
			var property;

			for (var i in module) {
				var property = module[i];
				if (typeof property == 'function') {
					script.push('	self["' + i.replace(/"/g, '\\"') + '"] = ' + property.toString() + ';');
				} else {
					dataProperties[i] = property;
				}
			}

			return '(' + workerBoilerScript.toString().replace('"__FUNCTIONS__"', script.join('\n')) + '());';

		},

		_onWorkerMessage: function(e) {
			var data = e.data;

			switch (data.cmd) {
				case 'console': 
					window.console && window.console[data.method].apply(window.console, data.args);
					break;
				case 'result':
					if (data.token in this.callbacks) {
						var cb = this.callbacks[data.token];
						delete this.callbacks[data.token];
						cb(data.result);
					} else {
						throw new Error('Operative: Unmatched token: ' + data.token);
					}
					break;
			}
		},

		_setupWorker: function() {

			var _self = this;

			var script = this._buildWorkerScript();
			var blob;

			try {
				blob = new Blob([script], { type: 'text/javascript' });
			} catch (e) {
				blob = new BlobBuilder();
				blob.append(script);
				blob = blob.getBlob();
			}

			var worker = this.worker = new Worker( URL.createObjectURL(blob) );

			worker.addEventListener('message', function(e) {
				_self._onWorkerMessage(e);
			});

			worker.postMessage({
				definitions: this.dataProperties
			});

		},

		_createExposedMethod: function(methodName) {

			var _self = this;

			this.api[methodName] = function() {

				if (_self.isDestroyed) {
					throw new Error('Operative: Cannot run method. Operative has already been destroyed');
				}

				var token = ++_self.curToken;
				var args = slice.call(arguments);
				var cb = args.pop();

				if (typeof cb != 'function') {
					throw new TypeError('Operative: Expected last argument to be Function (callback)');
				}

				if (operative.hasWorkerSupport) {

					_self.worker.postMessage({
						method: methodName,
						args: args,
						token: token
					});

					_self.callbacks[token] = cb;

				} else {
					setTimeout(function() {
						cb(
							_self.module[methodName].apply(_self.module, args)
						);
					}, 1);
				}
			};

		},

		_setupFallback: function() {
			this.module.isWorker = false;
			this.module.setup && this.module.setup();
		},

		destroy: function() {
			this.isDestroyed = true;
			if (this.worker) {
				this.worker.terminate();
			}
		}
	};

	operative.Operative = Operative;

	function operative(methods) {
		return new Operative(methods);
	}

	return operative;

/**
 * The boilerplate for the Worker Blob
 * (Be warned: this'll be executed within a worker, not here.)
 * Note: Indented @ Zero to make nicer debug code within worker :)
 */
function workerBoilerScript() {

"__FUNCTIONS__" // This replaceable token avoids minification issues

	self.console = {};
	self.isWorker = true;

	// Provide basic console interface:
	['log', 'debug', 'error', 'info', 'warn', 'time', 'timeEnd'].forEach(function(meth) {
		self.console[meth] = function() {
			self.postMessage({
				cmd: 'console',
				method: meth,
				args: [].slice.call(arguments)
			});
		};
	});

	self.addEventListener('message', function(e) {
		var defs = e.data.definitions;
		if (defs) {
			// Initial definitions:
			for (var i in defs) {
				self[i] = defs[i];
			}
			self.setup && self.setup();
			return;
		}
		var result = self[e.data.method].apply(self, e.data.args);
		self.postMessage({
			cmd: 'result',
			token: e.data.token,
			result: result
		});
	});
}

}());

