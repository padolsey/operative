// Helpers can go here...

var async = function async(fn) {
	// Little wrapper for async tests
	jasmine.getEnv().currentSpec.queue.add({
		execute: function(next) {
			fn(next);
		}
	});
};

if (typeof module != 'undefined' && module.exports) {
  exports.async = async;
} else {
  if (/_SpecRunner/.test(location.href)) {
    // Ensure correct base-url for grunt-run jasmine:
    operative.setBaseURL( operative.getBaseURL() + 'test/resources/' );
  }
}
