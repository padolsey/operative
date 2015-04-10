var MIN_BANNER = '/** Operative v<%= pkg.version %> (c) 2013 James padolsey, MIT-licensed, http://github.com/padolsey/operative **/\n';

var DEBUG_BANNER = [
	'/*!',
	' * Operative',
	' * ---',
	' * Operative is a small JS utility for seamlessly creating Web Worker scripts.',
	' * ---',
	' * @author James Padolsey http://james.padolsey.com',
	' * @repo http://github.com/padolsey/operative',
	' * @version <%= pkg.version %>',
	' * @license MIT',
	' */'
].join('\n') + '\n';

module.exports = function(grunt) {

	'use strict';

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		uglify: {
			options: {
				banner: MIN_BANNER,
				compress: true,
				mangle: true
			},
			dist: {
				src: 'dist/operative.js',
				dest: 'dist/operative.min.js'
			}
		},
		concat: {
			options: {
				banner: DEBUG_BANNER,
				stripBanners: true
			},
			dist_browser: {
				src: [
					'src/operative.js',
					'src/OperativeContext.js',
					'src/contexts/BrowserWorker.js',
					'src/contexts/Iframe.js'
				],
				dest: 'dist/operative.js'
			}
		},
		mocha_phantomjs: {
			all: {
				options: {
					urls: ['http://localhost:8000/test/resources/run.html']
				}
			}
		},
		connect: {
			server: {
				options: {
					port: 8000,
					base: '.'
				}
			}
		},
		bumpup: ['package.json', 'bower.json', 'component.json']
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-bumpup');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-mocha-phantomjs');

	grunt.registerTask('bump', function (type) {
		type = type ? type : 'patch';
		grunt.task.run('bumpup:' + type);
	});

	grunt.registerTask('default', ['test', 'build']);
	grunt.registerTask('build', ['concat:dist_browser', 'uglify:dist']);
	grunt.registerTask('test', ['connect', 'mocha_phantomjs']);

};
