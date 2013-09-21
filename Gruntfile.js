var path = require('path');
var fs = require('fs');

var VERSION = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf-8');

var MIN_BANNER = '/** Operative v' + VERSION + ' (c) 2013 James padolsey, MIT-licensed, http://github.com/padolsey/operative **/\n';

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
			dist: {
				src: ['src/operative.js'],
				dest: 'dist/operative.js'
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jasmine');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-concat');

	grunt.registerTask('default', ['build']);
	grunt.registerTask('test', ['jasmine']);

	grunt.registerTask('build', ['jasmine', 'concat:dist', 'uglify:dist']);

};