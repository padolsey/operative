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
		jasmine: {
			operative: {
				options: {
					specs: ['test/*Spec.js'],
					helpers: ['test/resources/specHelpers.js'],
					template: 'test/resources/jasmine.tmpl'
				}
			}
		},
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
			dist: {
				src: ['src/operative.js'],
				dest: 'dist/operative.js'
			}
		},
		bumpup: ['package.json', 'bower.json', 'component.json']
	});

	grunt.loadNpmTasks('grunt-contrib-jasmine');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-bumpup');

	grunt.registerTask('bump', function (type) {
		type = type ? type : 'patch';
		grunt.task.run('bumpup:' + type);
	});

	grunt.registerTask('default', ['build']);
	grunt.registerTask('test', ['jasmine']);

	grunt.registerTask('build', ['jasmine', 'concat:dist', 'uglify:dist']);

};
