/**
 * Iframe (degraded) context
 *
 * This executes the code in an iframe, via a zero-timeout on each method call.
 */
(function() {

	if (typeof window == 'undefined' && self.importScripts) {
		// Exit if operative.js is being loaded as worker (no blob support flow);
		return;
	}

	var Operative = operative.Operative;

	/**
	 * Operative IFrame
	 */
	Operative.Iframe = function Iframe(module) {
		Operative.apply(this, arguments);
	};

	var IframeProto = Operative.Iframe.prototype = operative.objCreate(Operative.prototype);

	var _loadedMethodNameI = 0;

	IframeProto._setup = function() {

		var self = this;
		var loadedMethodName = '__operativeIFrameLoaded' + (++_loadedMethodNameI);

		this.module.isWorker = false;

		var iframe = this.iframe = document.body.appendChild(
			document.createElement('iframe')
		);

		iframe.style.display = 'none';

		var iWin = this.iframeWindow = iframe.contentWindow;
		var iDoc = iWin.document;

		// Cross browser (tested in IE8,9) way to call method from within
		// IFRAME after all < script >s have loaded:
		window[loadedMethodName] = function() {

			window[loadedMethodName] = null;

			var script = iDoc.createElement('script');
			var js = self._buildContextScript(iframeBoilerScript);

			if (script.text !== void 0) {
				script.text = js;
			} else {
				script.innerHTML = js;
			}

			iDoc.documentElement.appendChild(script);

			for (var i in self.dataProperties) {
				iWin[i] = self.dataProperties[i];
			}

			self.isContextReady = true;
			self._dequeueAll();

		};

		iDoc.open();

		var documentContent = '';

		if (this.dependencies.length) {
			documentContent += '\n<script src="' + this.dependencies.join('"><\/script><script src="') + '"><\/script>';
		}
		
		// Place <script> at bottom to tell parent-page when dependencies are loaded:
		iDoc.write(
			documentContent +
			'\n<script>setTimeout(window.parent.' + loadedMethodName + ',0);<\/script>'
		);

		iDoc.close();

	};

	IframeProto._runMethod = function(methodName, token, args) {
		var self = this;

		var callback = this.callbacks[token];
		var deferred = this.deferreds[token];

		this.iframeWindow.__run__(methodName, args, function(result) {
			var cb = callback;
			var df = deferred;

			if (cb) {
				cb.apply(self, arguments);
			} else if (df) {
				df.fulfil(result);
			}
		}, deferred);
	};

	IframeProto.destroy = function() {
		this.iframe.parentNode.removeChild(this.iframe);
		Operative.prototype.destroy.call(this);
	};

/**
 * The boilerplate for the Iframe Context
 * NOTE:
 *	this'll be executed within an iframe, not here.
 *	Indented @ Zero to make nicer debug code within worker
 */
function iframeBoilerScript() {

	// Called from parent-window:
	window.__run__ = function(methodName, args, cb, deferred) {

		var isDeferred = false;

		window.deferred = function() {
			isDeferred = true;
			return deferred;
		};

		function callback() {
			return cb.apply(this, arguments);
		}

		// Define fallback transfer() method:
		callback.transfer = function() {
			// Remove [transfers] list (last argument)
			return cb.apply(this, [].slice.call(arguments, 0, arguments.length - 1));
		};

		if (cb) {
			args.push(callback);
		}

		var result = window[methodName].apply(window, args);

		window.deferred = function() {
			throw new Error('Operative: deferred() called at odd time');
		};


		if (!isDeferred && result !== void 0) {
			callback(result);
		}
	};
}

})();
