beforeEach(function() {
	this.addMatchers({
		toGenerate: function(expected) {
			return siml.parse(this.actual, {pretty:false}) === expected;
		}
	});
});