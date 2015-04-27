(function() {

	if (typeof window == 'undefined' && self.importScripts) {
		// Exit if operative.js is being loaded as worker (no blob support flow);
		return;
	}

	var hasOwn = {}.hasOwnProperty;
	var slice = [].slice;
	var toString = {}.toString;

	operative.Operative = OperativeContext;

	var Promise = OperativeContext.Promise = window.Promise;

	function OperativeTransfers(transfers) {
		this.value = transfers;
	}

	/**
	 * OperativeContext
	 * A type of context: could be a worker, an iframe, etc.
	 * @param {Object} module Object containing methods/properties
	 */
	function OperativeContext(module, dependencies, getBaseURL, getSelfURL) {

		var _self = this;

		module.get = module.get || function(prop) {
			return this[prop];
		};

		module.set = module.set || function(prop, value) {
			return this[prop] = value;
		};

		this._curToken = 0;
		this._queue = [];

		this._getBaseURL = getBaseURL;
		this._getSelfURL = getSelfURL;

		this.isDestroyed = false;
		this.isContextReady = false;

		this.module = module;
		this.dependencies = dependencies || [];

		this.dataProperties = {};
		this.api = {};
		this.callbacks = {};
		this.deferreds = {};

		this._fixDependencyURLs();
		this._setup();

		for (var methodName in module) {
			if (hasOwn.call(module, methodName)) {
				this._createExposedMethod(methodName);
			}
		}

		this.api.__operative__ = this;

		// Provide the instance's destroy method on the exposed API:
		this.api.destroy = this.api.terminate = function() {
			return _self.destroy();
		};

	}

	OperativeContext.prototype = {

		_marshal: function(v) {
			return v;
		},

		_demarshal: function(v) {
			return v;
		},

		_enqueue: function(fn) {
			this._queue.push(fn);
		},

		_fixDependencyURLs: function() {
			var deps = this.dependencies;
			for (var i = 0, l = deps.length; i < l; ++i) {
				var dep = deps[i];
				if (!/\/\//.test(dep)) {
					deps[i] = dep.replace(/^\/?/, this._getBaseURL().replace(/([^\/])$/, '$1/'));
				}
			}
		},

		_dequeueAll: function() {
			for (var i = 0, l = this._queue.length; i < l; ++i) {
				this._queue[i].call(this);
			}
			this._queue = [];
		},

		_buildContextScript: function(boilerScript) {

			var script = [];
			var module = this.module;
			var dataProperties = this.dataProperties;
			var property;

			for (var i in module) {
				property = module[i];
				if (typeof property == 'function') {
					script.push('	self["' + i.replace(/"/g, '\\"') + '"] = ' + property.toString() + ';');
				} else {
					dataProperties[i] = property;
				}
			}

			return script.join('\n') + (
				boilerScript ? '\n(' + boilerScript.toString() + '());' : ''
			);

		},

		_createExposedMethod: function(methodName) {

			var self = this;

			var method = this.api[methodName] = function() {

				if (self.isDestroyed) {
					throw new Error('Operative: Cannot run method. Operative has already been destroyed');
				}

				var token = ++self._curToken;
				var args = slice.call(arguments);
				var cb = typeof args[args.length - 1] == 'function' && args.pop();
				var transferables = args[args.length - 1] instanceof OperativeTransfers && args.pop();

				if (!cb && !Promise) {
					throw new Error(
						'Operative: No callback has been passed. Assumed that you want a promise. ' +
						'But `operative.Promise` is null. Please provide Promise polyfill/lib.'
					);
				}

				if (cb) {

					self.callbacks[token] = cb;

					// Ensure either context runs the method async:
					setTimeout(function() {
						runMethod();
					}, 1);

				} else if (Promise) {

					// No Callback -- Promise used:

					return new Promise(function(resolve, reject) {
						var deferred;

						if (resolve.fulfil || resolve.fulfill) {
							// Backwards compatibility
							deferred = resolve;
							deferred.fulfil = deferred.fulfill = resolve.fulfil || resolve.fulfill;
						} else {
							deferred = {
								// Deprecate:
								fulfil: resolve,
								fulfill: resolve,

								resolve: resolve,
								reject: reject,

								// For the iframe:
								transferResolve: resolve,
								transferReject: reject
							};
						}

						self.deferreds[token] = deferred;
						runMethod();
					});

				}

				function runMethod() {
					if (self.isContextReady) {
						self._runMethod(methodName, token, args, transferables);
					} else {
						self._enqueue(runMethod);
					}
				}

			};

			method.transfer = function() {

				var args = [].slice.call(arguments);
				var transfersIndex = typeof args[args.length - 1] == 'function' ?
					args.length - 2:
					args.length - 1;
				var transfers = args[transfersIndex];
				var transfersType = toString.call(transfers);

				if (transfersType !== '[object Array]') {
					throw new Error(
						'Operative:transfer() must be passed an Array of transfers as its last arguments ' +
						'(Expected: [object Array], Received: ' + transfersType + ')'
					);
				}

				args[transfersIndex] = new OperativeTransfers(transfers);
				return method.apply(null, args);

			};

		},

		destroy: function() {
			this.isDestroyed = true;
		}
	};

})();
