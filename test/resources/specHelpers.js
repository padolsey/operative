// Helpers can go here...

var async = function async(fn) {
	// Little wrapper for async tests
	jasmine.getEnv().currentSpec.queue.add({
		execute: function(next) {
			fn(next);
		}
	});
};