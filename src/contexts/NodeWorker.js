var cp = require('child_process');
var path = require('path');
var Operative = require('../OperativeContext');

module.exports = NodeWorker;

/**
 * Operative NodeWorker
 */
function NodeWorker(module) {
	Operative.apply(this, arguments);
}

var WorkerProto = NodeWorker.prototype = Object.create(Operative.prototype);

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

	var child = this.child = cp.fork(path.join(__dirname, '../helpers/nodeChildProcess'));

	var script = this._buildContextScript('');

	if (this.dependencies.length) {
		script = 'importScripts("' + this.dependencies.join('", "') + '");\n' + script;
	}

	child.send(script);
	child.send({
		definitions: this.dataProperties
	});
	this.isContextReady = true;
	child.on('message', this._onWorkerMessage.bind(this));

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
	this.child.kill();
	Operative.prototype.destroy.call(this);
};
