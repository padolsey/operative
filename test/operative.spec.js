describe('Operative (worker Context)', function() {

	describe('Callback', function() {
		it('Is called correctly', function(done) {
			var o = operative({
				longAction: function(cb) {
					for (var i = 0; i < 10000000; ++i);
					cb();
				}
			});

			function callback() {
				done();
			}

			o.longAction(callback);
			expect(o.__operative__.callbacks[1]).to.equal(callback);

		});
	});

	describe('Destroying', function() {
		it('Should have destroy + terminate alias', function() {
			expect(function() {
				operative(function(){}).destroy();
				operative(function(){}).terminate();
			}).to.not.throw();
		});
	});

	describe('Multiple Operatives', function() {
		it('Each complete asynchronously', function(done) {
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
			function add(v) {
				s.push(v);
				if (s.length === 3) {
					expect(s.sort().join('')).to.equal('ABC');
					done();
				}
			}

			a.run(add);
			b.run(add);
			c.run(add);

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
				expect(op() instanceof operative.Operative.Promise).to.be.true;
			});
			describe('fulfil()', function() {
				it('Should fulfil the exposed promise', function(done) {
					var fulfilled = false;

					op(true).then(function(a) {
						expect(a).to.equal(873);
						done();
					}, function() {
						expect(true).to.be.false; // this should not run
						done();
					});

				});
			});
			describe('reject()', function() {
				it('Should reject the exposed promise', function(done) {
					var rejected = false;
					var fulfilled = false;
					op(false).then(function() {
						expect(true).to.be.false; // this should not run
						done();
					}, function(err) {
						expect(err).to.equal(999);
						done();
					});
				});
			});
			describe('Rejecting with an error', function() {
				it('Should reject correctly', function(done) {
					var op = operative(function() {
						var deferred = this.deferred();
						deferred.reject(new Error('foo 789'));
					});
					op().then(function() {
						expect(true).to.be.false; // fail
						done();
					}).catch(function(err) {
						expect(err.message).to.equal('foo 789'); // pass
						done();
					});
				});
				describe('With additional props', function() {
					it('Should reject correctly and be received with props', function(done) {
						var op = operative(function() {
							var deferred = this.deferred();
							var error = new Error('foo');
							error.custom = 123;
							deferred.reject(error);
						});
						op().then(function() {
							expect(true).to.be.false; // fail
							done();
						}).catch(function(err) {
							expect(err.message).to.equal('foo');
							expect(err.custom).to.equal(123);
							done();
						});
					});
				});
			});
		});
	});

	describe('An example stream of operations', function() {

		it('Works with basic calculator', function(done) {
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

			o.setup()
				.then(function() {
					return o.add(1, 2);
				})
				.then(function(n) {
					expect(n).to.equal(3);
				})
				.then(o.isItAWorker_Promisable)
				.then(function(isWorker) {
					expect(isWorker).to.equal( operative.hasWorkerSupport );
				})
				.then(o.isItAWorker)
				.then(function(isWorker) {
					expect(isWorker).to.equal( operative.hasWorkerSupport );
				})
				.then(o.getSomething)
				.then(function(n) {
					expect(n).to.equal(3333);
				})
				.then(o.getSomethingElse)
				.then(function(n) {
					expect(n).to.equal(4444);
				})
				.then(function() {
					return o.subtract(100, 2);
				})
				.then(function(n) {
					expect(n).to.equal(98);
				})
				.then(done, done);

		});

	});

	describe('Dependency loading', function() {

		it('Can load dependencies', function(done) {
			var o = operative({
				typeofDependencies: function(cb) {
					cb([ typeof dependency1, typeof dependency2 ]);
				}
			}, ['dependency1.js', 'dependency2.js']);

			o.typeofDependencies(function(t) {
				expect(t).to.deep.equal(['function', 'function']);
				done();
			});
		});

		it('Can load external dependencies', function(done) {
			var o = operative({
				version_: function(cb) {
					cb( _.VERSION );
				}
			}, ['http://cdnjs.cloudflare.com/ajax/libs/lodash.js/1.3.1/lodash.min.js']);

			o.version_(function(t) {
				expect(t).to.equal('1.3.1');
				done();
			});

		});
	});

	describe('No blob-support case', function() {
		beforeEach(function() {
			operative.Operative.BrowserWorker.prototype._isWorkerViaBlobSupported = function() {
				return false;
			};
		});
		it('Works correctly', function(done) {
			var o = operative(function() {
				return 888;
			});
			o(function(v) {
				expect(v).to.equal(888);
				done();
			});
		});
		describe('Explicitly setting the self URL', function() {
			beforeEach(function() {
				operative.setSelfURL(
					'../../src/contexts/BrowserWorker.js?test-explicit'
				);
			});
			it('Works; a new Worker is created with that URL', function(done) {
				var o = operative(function() {
					return self.location.href;
				});
				o(function(url) {
					if (operative.hasWorkerSupport) {
						// Worker context
						expect(url).to.contain('?test-explicit');
					} else {
						// Iframe context (self-url changing does nothing)
						expect(url).to.contain('.html');
					}
					done();
				});
			});
		});
	});

	describe('Perpetual callbacks', function() {

		it('Is possible to keep calling the same callback (with progress etc.)', function(done) {

			var o = operative({
				process: function(cb) {

					var progress = 0;
					var me = setInterval(function() {
						progress++;
						if (progress === 5) {
							clearInterval(me);
							cb({ progress: 5, done: true });
						} else {
							cb({ progress: progress, done: false });
						}
					}, 30);

				}
			});

			var called = 0;

			o.process(function(status) {
				called++;
				expect(status.progress).to.be.above(0);
				if (status.progress === 5) {
					expect(status.done).to.equal(true);
					expect(called).to.equal(5); // called five times
					done();
				}
			});

		});

	});

	describe('Transfers', function() {
		describe('Using callback API', function() {
			it('Transfers ownership of the buffer', function(done) {

				if (!operative.hasTransferSupport && typeof Uint8Array == 'undefined') {
					done();
					return;
				}

				var o = operative({
					receive: function(t, cb) {
						self.arr = new Uint8Array([1,2,3]);
						cb.transfer(self.arr.buffer, [self.arr.buffer]);
					},
					isYourByteLengthEmpty: function(cb) {
						cb(
							0 == (self.arr.buffer ? self.arr.buffer.byteLength : self.arr.byteLength)
						);
					}
				});

				var a = new Uint8Array([33,22,11]);

				o.receive.transfer(a.buffer, [a.buffer], function(r) {
					if (operative.hasTransferSupport) {
						expect(a.buffer ? a.buffer.byteLength : a.byteLength).to.equal(0);
					}
					o.isYourByteLengthEmpty(function(result) {
						if (operative.hasTransferSupport) {
							expect(result).to.be.true;
						}
						done();
					})
				});

			});
		});
		describe('Using promise API', function() {
			it('Transfers ownership of the buffer', function(done) {

				if (!operative.hasTransferSupport && typeof Uint8Array == 'undefined') {
					done();
					return;
				}

				var o = operative({
					receive: function(t, cb) {
						self.arr = new Uint8Array([1,2,3]);
						var def = this.deferred();
						def.transferResolve(self.arr.buffer, [self.arr.buffer]);
					},
					isYourByteLengthEmpty: function(cb) {
						this.deferred().resolve(
							0 == (self.arr.buffer ? self.arr.buffer.byteLength : self.arr.byteLength)
						);
					}
				});

				var a = new Uint8Array([33,22,11]);

				o.receive.transfer(a.buffer, [a.buffer])
					.then(function(r) {
						if (operative.hasTransferSupport) {
							expect(a.buffer ? a.buffer.byteLength : a.byteLength).to.equal(0);
						}
						return o.isYourByteLengthEmpty().then(function(result) {
							if (operative.hasTransferSupport) {
								expect(result).to.be.true;
							}
						})
					}).then(done, done);

			});
		});
	});

});