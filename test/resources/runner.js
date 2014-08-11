var env = jasmine.getEnv();
var reporter = new jasmine.TapReporter();
env.addReporter(reporter);
// env.addReporter( new jasmine.TrivialReporter() );
env.execute();