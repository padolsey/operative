describe('Operative (forced iframe context)', function() {

	beforeEach(function() {
		operative.hasWorkerSupport = false;
	});

	afterEach(function() {
		operative.hasWorkerSupport = true;
	});

	describe('Callback', function() {
		it('Is called and removed correctly', function(done) {
			var o = operative({
				longAction: function(cb) {
					for (var i = 0; i < 100000; ++i);
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
				op = operative(function(beSuccessful) {
					var deferred = this.deferred();
					if (beSuccessful) {
						deferred.fulfil(873);
					} else {
						deferred.reject(999);
					}
				});
			})
			it('Should return a promise', function() {
				expect(op() instanceof operative.Operative.Promise).to.equal(true);
			});
			describe('fulfil()', function() {
				it('Should fulfil the exposed promise', function(done) {
					op(true).then(function(a) {
						expect(a).to.equal(873);
						done();
					}, function() {});
				});
			});
			describe('reject()', function() {
				it('Should reject the exposed promise', function(done) {
					op(false).then(function() {
						expect(true).to.equal(false); // this should not run
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
						console.log(err);
						expect(err.message).to.equal('foo 789'); // pass
						done();
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
					expect(isWorker).to.equal(false);
				})
				.then(o.isItAWorker)
				.then(function(isWorker) {
					expect(isWorker).to.equal(false);
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
			it('Works in fallback state (no ownership transfer)', function(done) {

				if (typeof Uint8Array == 'undefined') {
					done();
					return;
				}

				var o = operative({
					receive: function(t, cb) {
						self.arr = new Uint8Array([1,2,3]);
						cb.transfer(self.arr.buffer, [self.arr.buffer]);
					},
					isYourByteLengthIsNonEmpty: function(cb) {
						cb(
							3 == (self.arr.buffer ? self.arr.buffer.byteLength : self.arr.byteLength)
						);
					}
				});

				var a = new Uint8Array([33,22,11]);

				o.receive.transfer(a.buffer, [a.buffer], function(r) {
					expect(a.buffer ? a.buffer.byteLength : a.byteLength).to.equal(3);
					o.isYourByteLengthIsNonEmpty(function(result) {
						expect(result).to.be.true;
						done();
					})
				});

			});
		});
		describe('Using promise API', function() {
			it('Works in fallback state (no ownership transfer)', function(done) {

				if (typeof Uint8Array == 'undefined') {
					done();
					return;
				}

				var o = operative({
					receive: function(t, cb) {
						self.arr = new Uint8Array([1,2,3]);
						var def = this.deferred();
						def.transferResolve(self.arr.buffer, [self.arr.buffer]);
					},
					isYourByteLengthIsNonEmpty: function(cb) {
						this.deferred().resolve(
							3 == (self.arr.buffer ? self.arr.buffer.byteLength : self.arr.byteLength)
						);
					}
				});

				var a = new Uint8Array([33,22,11]);

				o.receive.transfer(a.buffer, [a.buffer])
					.then(function(r) {
						expect(a.buffer ? a.buffer.byteLength : a.byteLength).to.equal(3);
						return o.isYourByteLengthIsNonEmpty().then(function(result) {
							expect(result).to.be.true;
						})
					}).then(done, done);

			});
		});
	});

});