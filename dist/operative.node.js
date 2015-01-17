/*!
 * Operative
 * ---
 * Operative is a small JS utility for seamlessly creating Web Worker scripts.
 * ---
 * @author James Padolsey http://james.padolsey.com
 * @repo http://github.com/padolsey/operative
 * @version 0.3.2
 * @license MIT
 */
var operative;
(function() {

	/**
	 * Exposed operative factory
	 */
	operative = function operative(module, dependencies) {

		var OperativeContext = operative.hasWorkerSupport ?
			isNode ? Operative.NodeWorker : Operative.BrowserWorker : Operative.Iframe;

		if (typeof module == 'function') {
			// Allow a single function to be passed.
			var o = new OperativeContext({ main: module }, dependencies);
			var singularOperative = function() {
				return o.api.main.apply(o, arguments);
			};
			// Copy across exposable API to the returned function:
			for (var i in o.api) {
				if (hasOwn.call(o.api, i)) {
					singularOperative[i] = o.api[i];
				}
			}
			return singularOperative;
		}

		return new OperativeContext(module, dependencies).api;

	}

	var isNode = typeof self == 'undefined' && typeof process != 'undefined' && process.title == 'node';

	if (!isNode && typeof window == 'undefined' && self.importScripts) {
		// I'm a worker! Run the boiler-script:
		// (Operative itself is called in IE10 as a worker,
		//	to avoid SecurityErrors)
		workerBoilerScript();
		return;
	}

	// Default base URL (to be prepended to relative dependency URLs)
	// is current page's parent dir:
	var baseURL = !isNode && (
		location.protocol + '//' +
		location.hostname +
		(location.port?':'+location.port:'') +
		location.pathname
	).replace(/[^\/]+$/, '');

	/**
	 * Provide Object.create shim
	 */
	operative.objCreate = Object.create || function(o) {
		function F() {}
		F.prototype = o;
		return new F();
	};

	var slice = [].slice;
	var hasOwn = {}.hasOwnProperty;

	// Indicates whether operatives will run within workers:
	operative.hasWorkerSupport = isNode || !!window.Worker;
	operative.Promise = (isNode && require('bluebird')) || window.Promise;

	// Expose:
	if (typeof define === 'function' && define.amd) {
		define( function () { return operative; });
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = operative;
	}

	operative.setSelfURL = function(url) {
		opScriptURL = url;
	};

	operative.setBaseURL = function(base) {
		baseURL = base;
	};

	operative.getBaseURL = function() {
		return baseURL;
	};

	/**
	 * Operative: Exposed Operative Constructor
	 * @param {Object} module Object containing methods/properties
	 */
	function Operative(module, dependencies) {

		var _self = this;

		module.get = module.get || function(prop) {
			return this[prop];
		};

		module.set = module.set || function(prop, value) {
			return this[prop] = value;
		};

		this._curToken = 0;
		this._queue = [];

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

	Operative.prototype = {

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
					deps[i] = dep.replace(/^\/?/, baseURL);
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
					script.push('	 asdasd["' + i.replace(/"/g, '\\"') + '"] = ' + property.toString() + ';');
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

			this.api[methodName] = function() {

				if (self.isDestroyed) {
					throw new Error('Operative: Cannot run method. Operative has already been destroyed');
				}

				var token = ++self._curToken;
				var args = slice.call(arguments);
				var cb = typeof args[args.length - 1] == 'function' && args.pop();

				if (!cb && !operative.Promise) {
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

				} else if (operative.Promise) {

					// No Callback -- Promise used:

					return new operative.Promise(function(fulfil, reject) {
						var deferred;

						if (fulfil.fulfil || fulfil.fulfill) {
							// Backwards compatibility
							deferred = fulfil;
							deferred.fulfil = deferred.fulfill = fulfil.fulfil || fulfil.fulfill;
						} else {
							deferred = {
								fulfil: fulfil,
								fulfill: fulfil,
								reject: reject
							};
						}

						self.deferreds[token] = deferred;
						runMethod();
					});

				}

				function runMethod() {
					if (self.isContextReady) {
						self._runMethod(methodName, token, args);
					} else {
						self._enqueue(runMethod);
					}
				}

			};

		},

		destroy: function() {
			this.isDestroyed = true;
		}
	};

	operative.Operative = Operative;


}());
(function() {

var Operative = operative.Operative;
var cp = require('child_process');
var path = require('path');


/**
 * Operative NodeWorker
 */
Operative.NodeWorker = function NodeWorker(module) {
	this._msgQueue = [];
	Operative.apply(this, arguments);
};

var WorkerProto = Operative.NodeWorker.prototype = Object.create(Operative.prototype);

WorkerProto._onWorkerMessage = function(msg) {

  switch (msg.cmd) {
    case 'console':
      window.console && window.console[msg.method].apply(window.console, msg.args);
      break;
    case 'result':

      var callback = this.callbacks[msg.token];
      var deferred = this.deferreds[msg.token];

      delete this.callbacks[msg.token];
      delete this.deferreds[msg.token];

      var deferredAction = msg.result && msg.result.isDeferred && msg.result.action;

      if (deferred && deferredAction) {
        deferred[deferredAction](msg.result.args[0]);
      } else if (callback) {
        callback.apply(this, msg.result.args);
      }

      break;
  }
};

WorkerProto._setup = function() {

  var child = this.child = cp.fork(path.join(__dirname, '../src/nodeChildProcess'));

  var script = this._buildContextScript('');

  child.send(script);

  this.isContextReady = true;
  child.on('message', this._onWorkerMessage.bind(this));


  // TODO: MAKE DEPS WORK
	// if (this.dependencies.length) {
	// 	script = 'importScripts("' + this.dependencies.join('", "') + '");\n' + script;
	// }

};

WorkerProto._postMessage = function(msg) {
	return this.child.send(msg);
};

WorkerProto._runMethod = function(methodName, token, args) {
	this._postMessage({
		method: methodName,
		args: args,
		token: token
	});
};

WorkerProto.destroy = function() {
	this.worker.terminate();
	Operative.prototype.destroy.call(this);
};

}());