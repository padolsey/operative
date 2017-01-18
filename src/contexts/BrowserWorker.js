/**
 * Web Worker context
 */
(function() {

	if (typeof window == 'undefined' && self.importScripts) {
		// I'm a worker! Run the boiler-script:
		// (Operative itself is called in IE10 as a worker,
		//	to avoid SecurityErrors)
		workerBoilerScript();
		return;
	}

	var Operative = operative.Operative;

	var URL = window.URL || window.webkitURL;
	var BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;

	var workerViaBlobSupport = (function() {
		try {
			new Worker(makeBlobURI(';'));
		} catch(e) {
			return false;
		}
		return true;
	}());

	var transferrableObjSupport = (function() {
		try {
			var ab = new ArrayBuffer(1);
			new Worker( makeBlobURI(';') ).postMessage(ab, [ab]);
			return !ab.byteLength;
		} catch(e) {
			return false;
		}
	}());

	operative.hasWorkerViaBlobSupport = workerViaBlobSupport;
	operative.hasTransferSupport = transferrableObjSupport;

	function makeBlobURI(script) {
		var blob;

		try {
			blob = new Blob([script], { type: 'text/javascript' });
		} catch (e) {
			blob = new BlobBuilder();
			blob.append(script);
			blob = blob.getBlob();
		}

		return URL.createObjectURL(blob);
	}

	/**
	 * Operative BrowserWorker
	 */
	Operative.BrowserWorker = function BrowserWorker() {
		Operative.apply(this, arguments);
	};

	var WorkerProto = Operative.BrowserWorker.prototype = operative.objCreate(Operative.prototype);

	WorkerProto._onWorkerMessage = function(e) {
		var data = e.data;

		if (typeof data === 'string' && data.indexOf('pingback') === 0) {
			if (data === 'pingback:structuredCloningSupport=NO') {
				// No structuredCloningSupport support (marshal JSON from now on):
				this._marshal = function(o) { return JSON.stringify(o); };
				this._demarshal = function(o) { return JSON.parse(o); };
			}

			this.isContextReady = true;
			this._postMessage({
				definitions: this.dataProperties
			});
			this._dequeueAll();
			return;

		}

		data = this._demarshal(data);

		switch (data.cmd) {
			case 'console':
				window.console && window.console[data.method].apply(window.console, data.args);
				break;
			case 'deferred_reject_error':
				this.deferreds[data.token].reject(data.error);
				break;
			case 'result':

				var callback = this.callbacks[data.token];
				var deferred = this.deferreds[data.token];

				var deferredAction = data.result && data.result.isDeferred && data.result.action;

				if (deferred && deferredAction) {
					deferred[deferredAction](data.result.args[0]);
				} else if (callback) {
					callback.apply(this, data.result.args);
				} else if (deferred) {
					// Resolve promise even if result was given
					// via callback within the worker:
					deferred.fulfil(data.result.args[0]);
				}

				break;
		}
	};

	WorkerProto._isWorkerViaBlobSupported = function() {
		return workerViaBlobSupport;
	};

	WorkerProto._setup = function() {
		var self = this;

		var worker;
		var selfURL = this._getSelfURL();
		var blobSupport = this._isWorkerViaBlobSupported();
		var script = this._buildContextScript(
			// The script is not included if we're Eval'ing this file directly:
			blobSupport ? workerBoilerScript : ''
		);

		if (this.dependencies.length) {
			script = 'importScripts("' + this.dependencies.join('", "') + '");\n' + script;
		}

		if (blobSupport) {
			worker = this.worker = new Worker( makeBlobURI(script) );
		}	else {

			if (!selfURL) {
				throw new Error('Operaritve: No operative.js URL available. Please set via operative.setSelfURL(...)');
			}
			worker = this.worker = new Worker( selfURL );
			// Marshal-agnostic initial message is boiler-code:
			// (We don't yet know if structured-cloning is supported so we send a string)
			worker.postMessage('EVAL|' + script);
		}

		worker.postMessage('EVAL|self.hasTransferSupport=' + transferrableObjSupport);
		worker.postMessage(['PING']); // Initial PING

		worker.addEventListener('message', function(e) {
			self._onWorkerMessage(e);
		});
	};

	WorkerProto._postMessage = function(msg) {
		var transfers = transferrableObjSupport && msg.transfers;
		return transfers ?
			this.worker.postMessage(msg, transfers.value) :
			this.worker.postMessage(
				this._marshal(msg)
			);
	};

	WorkerProto._runMethod = function(methodName, token, args, transfers) {
		this._postMessage({
			method: methodName,
			args: args,
			token: token,
			transfers: transfers
		});
	};

	WorkerProto.destroy = function() {
		this.worker.terminate();
		Operative.prototype.destroy.call(this);
	};

/**
 * The boilerplate for the Worker Blob
 * NOTE:
 *	this'll be executed within an worker, not here.
 *	Indented @ Zero to make nicer debug code within worker
 */
function workerBoilerScript() {

	var postMessage = self.postMessage;
	var structuredCloningSupport = null;
	var toString = {}.toString;

	self.console = {};
	self.isWorker = true;

	// Provide basic console interface:
	['log', 'debug', 'error', 'info', 'warn', 'time', 'timeEnd'].forEach(function(meth) {
		self.console[meth] = function() {
			postMessage({
				cmd: 'console',
				method: meth,
				args: [].slice.call(arguments)
			});
		};
	});

	self.addEventListener('message', function(e) {

		var data = e.data;

		if (typeof data == 'string' && data.indexOf('EVAL|') === 0) {
			eval(data.substring(5));
			return;
		}

		if (structuredCloningSupport == null) {

			// e.data of ['PING'] (An array) indicates structuredCloning support
			// e.data of '"PING"' (A string) indicates no support (Array has been serialized)
			structuredCloningSupport = e.data[0] === 'PING';

			// Pingback to parent page:
			self.postMessage(
				structuredCloningSupport ?
					'pingback:structuredCloningSupport=YES' :
					'pingback:structuredCloningSupport=NO'
			);

			if (!structuredCloningSupport) {
				postMessage = function(msg) {
					// Marshal before sending
					return self.postMessage(JSON.stringify(msg));
				};
			}

			return;
		}

		if (!structuredCloningSupport) {
			// Demarshal:
			data = JSON.parse(data);
		}

		var defs = data.definitions;
		var isDeferred = false;
		var args = data.args;

		if (defs) {
			// Initial definitions:
			for (var i in defs) {
				self[i] = defs[i];
			}
			return;
		}

		function callback() {
			// Callback function to be passed to operative method
			returnResult({
				args: [].slice.call(arguments)
			});
		}

		callback.transfer = function() {
			var args = [].slice.call(arguments);
			var transfers = extractTransfers(args);
			// Callback function to be passed to operative method
			returnResult({
				args: args
			}, transfers);
		};

		args.push(callback);

		self.deferred = function() {
			isDeferred = true;
			var def = {};
			function resolve(r, transfers) {
				returnResult({
					isDeferred: true,
					action: 'resolve',
					args: [r]
				}, transfers);
				return def;
			}
			function reject(r, transfers) {
				if (r instanceof Error) {
					// Create an error object that can be cloned: (See #44/#45):
					var cloneableError = {
						message: r.message,
						stack: r.stack,
						name: r.name,
						code: r.code
					};
					for (var i in r) {
						if (r.hasOwnProperty(i)) {
							cloneableError[i] = r[i];
						}
					}
					postMessage({
						cmd: 'deferred_reject_error',
						token: data.token,
						error: cloneableError
					});
					return;
				}
				returnResult({
					isDeferred: true,
					action: 'reject',
					args: [r]
				}, transfers);
			}
			// Deprecated:
			def.fulfil = def.fulfill = def.resolve = function(value) {
				return resolve(value);
			};
			def.reject = function(value) {
				return reject(value);
			};
			def.transferResolve = function(value) {
				var transfers = extractTransfers(arguments);
				return resolve(value, transfers);
			};
			def.transferReject = function(value) {
				var transfers = extractTransfers(arguments);
				return reject(value, transfers);
			};
			return def;
		};

		// Call actual operative method:
		var result = self[data.method].apply(self, args);

		if (!isDeferred && result !== void 0) {
			// Deprecated direct-returning as of 0.2.0
			returnResult({
				args: [result]
			});
		}

		self.deferred = function() {
			throw new Error('Operative: deferred() called at odd time');
		};

		function returnResult(res, transfers) {
			postMessage({
				cmd: 'result',
				token: data.token,
				result: res
			}, self.hasTransferSupport && transfers || []);
		}

		function extractTransfers(args) {
			var transfers = args[args.length - 1];

			if (toString.call(transfers) !== '[object Array]') {
				throw new Error('Operative: callback.transfer() must be passed an Array of transfers as its last arguments');
			}

			return transfers;
		}
	});
}

})();
