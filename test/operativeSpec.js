describe('Operative (Worker Context)', function() {

	describe('Callback', function() {
		it('Is called and removed correctly', function() {
			var o = operative({
				longAction: function(cb) {
					for (var i = 0; i < 10000000; ++i);
					cb();
				}
			});
			var callback = jasmine.createSpy('callback');

			o.longAction(callback);

			runs(function() {
				expect(o.__operative__.callbacks[1]).toBe(callback);
			});

			waitsFor(function() {
				return callback.callCount === 1;
			});

			runs(function() {
				expect(o.__operative__.callbacks[1]).not.toBeDefined();
			});

		});
	});

	describe('Destroying', function() {
		it('Should have destroy + terminate alias', function() {
			operative(function(){}).destroy();
			operative(function(){}).terminate();
		});
	});

	describe('Async Operative', function() {
		it('Should be able to return [within the worker] asynchronously', function() {
			var o = operative({
				doAsyncFoo: function() {
					var finish = this.async();
					setTimeout(function() {
						finish(123);
					}, 150);
				},
				doAsyncBar: function() {
					var finish = this.async();
					setTimeout(function() {
						finish(456);
					}, 10);
				}
			});

			var result = [];

			runs(function() {
				o.doAsyncFoo(function(v) { result.push(v); });
				o.doAsyncBar(function(v) { result.push(v); });
			});

			waitsFor(function(nxt) {
				return result.length === 2;
			});

			runs(function() {
				expect(result).toEqual([456, 123]);
			});
		});
	});

	describe('Multiple Operatives', function() {
		it('Each complete asynchronously', function() {
			var s = [];
			var a = operative({
				run: function(cb) {
					for (var i = 0; i < 1000000; ++i);
					cb('A');
				}
			});
			var b = operative({
				run: function(cb) {
					for (var i = 0; i < 1000; ++i);
					cb('B');
				}
			});
			var c = operative({
				run: function(cb) {
					for (var i = 0; i < 1; ++i);
					cb('C');
				}
			});
			function add(v) { s.push(v); }

			a.run(add);
			b.run(add);
			c.run(add);

			expect(s.length).toBe(0);
			waitsFor(function() {
				return s.length === 3;
			});
			runs(function() {
				expect(s.sort().join('')).toBe('ABC');
			});
		});
	});

	describe('Promise API', function() {
		describe('Operative', function() {
			var op;
			beforeEach(function() {
				op = operative(function(beSuccessful, cb) {
					var deferred = this.deferred();
					if (beSuccessful) {
						deferred.fulfil(873);
					} else {
						deferred.reject(999);
					}
				});
			})
			it('Should return a promise', function() {
				expect(op() instanceof operative.Promise).toBe(true);
			});
			describe('fulfil()', function() {
				it('Should fulfil the exposed promise', function() {
					var fulfilled = false;
					runs(function() {
						op(true).then(function(a) {
							expect(a).toBe(873);
							fulfilled = true;
						}, function() {});
					});
					waitsFor(function() {
						return fulfilled === true;
					});
				});
			});
			describe('reject()', function() {
				it('Should reject the exposed promise', function() {
					var rejected = false;
					var fulfilled = false;
					runs(function() {
						op(false).then(function() {
							fulfilled = true;
						}, function(err) {
							expect(err).toBe(999);
							rejected = true;
						});
					});
					waitsFor(function() {
						return rejected === true;
					});
					runs(function() {
						expect(fulfilled).toBe(false);
					});
				});
			});
		});
	});

	describe('An example stream of operations', function() {

		it('Works with basic calculator', function() {
			var o = operative({
				something: 3333,
				setup: function(cb) {
					this.somethingElse = 4444;
					cb();
				},
				add: function(a, b) {
					return a + b;
				},
				subtract: function(a, b) {
					return a - b;
				},
				getSomething: function() {
					return this.something;
				},
				getSomethingElse: function() {
					return this.somethingElse;
				},
				isItAWorker: function() {
					return this.isWorker;
				},
				isItAWorker_Promisable: function() {
					this.deferred().fulfil(this.isWorker);
				}
			});

			async(function(nxt) {
				o.setup(nxt);
			});

			async(function(nxt) {
				o.add(1, 2, function(n) {
					expect(n).toBe(3);
					nxt();
				});
			});

			async(function(nxt) {
				o.isItAWorker_Promisable().then(function(isWorker) {
					expect(isWorker).toBe(true);
					nxt();
				}, function() {});
			});

			async(function(nxt) {
				o.getSomething(function(n) {
					expect(n).toBe(3333);
					nxt();
				});
			});

			async(function(nxt) {
				o.getSomethingElse(function(n) {
					expect(n).toBe(4444);
					nxt();
				});
			});

			async(function(nxt) {
				o.subtract(100, 2, function(n) {
					expect(n).toBe(98);
					nxt();
				});
			});

		});

	});

	describe('Dependency loading', function() {

		it('Can load dependencies', function() {
			var o = operative({
				typeofDependency1: function(cb) {
					cb( typeof dependency1 );
				},
				typeofDependency2: function(cb) {
					cb( typeof dependency2 );
				}
			}, ['dependency1.js', 'dependency2.js']);

			async(function(nxt) {
				o.typeofDependency1(function(t) {
					expect(t).toBe('function');
					nxt();
				});
			});

			async(function(nxt) {
				o.typeofDependency2(function(t) {
					expect(t).toBe('function');
					nxt();
				});
			});
		});

		it('Can load external dependencies', function() {
			var o = operative({
				version_: function(cb) {
					cb( _.VERSION );
				}
			}, ['http://cdnjs.cloudflare.com/ajax/libs/lodash.js/1.3.1/lodash.min.js']);

			async(function(nxt) {
				o.version_(function(t) {
					expect(t).toBe('1.3.1');
					nxt();
				});
			});

		});
	});

});