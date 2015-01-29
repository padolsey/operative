'use strict';

function computation(done) {
  // Do something silly and slow:
  var r = Math.random();
  done(
    Array(4000).join(
      [+new Date, +new Date].join(';')
    ).split('').map(function(a) {
      return a.charCodeAt(0) * r;
    })
  );
}

var test = (function() {

  var queue = [];

  var hrtime = typeof performance != 'undefined' ? function(prev) {
    prev = prev || [0, 0];
    // From [seconds, nanoseconds] to MS
    prev = prev[1] / 1e6 + (prev[0] * 1000);
    var now = performance.now() - prev;
    var s = 0 | now / 1000;
    // Back to [seconds, ~nanoseconds]
    return [s, 0 | (now - s * 1e3) * 1e6];
  } : process.hrtime;

  function runTest(name, fn) {

    console.log('Running: ', name)

    var SAMPLE_SIZE = 1;
    var total = 0;
    var i = 0;

    setTimeout(tick, 100);

    function tick() {

      if (i >= SAMPLE_SIZE) {
        console.log(name + ': Avg. ' + total/SAMPLE_SIZE + 'ms');
        dequeue();
        return;
      }

      var now = hrtime();

      fn(function(cb) {
        var diff = hrtime(now);
        total += diff[1] / 1e6 + (diff[0] * 1000);
        cb && cb(); // for the test to terminate its things
        ++i;
        setTimeout(tick, 100);
      });
    }

  }

  function dequeue() {
    queue.shift();
    if (queue.length) {
      queue[0]();
    }
  }

  return function(name, fn) {
    var i = queue.push(function() {
      runTest(name, fn);
    });
    if (i === 1) { // was first element in queue
      queue[0]();
    }
  };

}());


test('Sync In Page', function(done) {
  for (var i = 0; i < 36; i++) {
    computation(function(){});
  }
  done();
});

test('Operative #1', function(done) {
  var c = operative({
    exec: function(cb) {
      for (var i = 0; i < 36; i++) {
        this.computation(function(){});
      }
      cb();
    },
    computation: computation
  });
  c.exec(function(x) {
    console.log('GotResult')
    done(function() {
      console.log('Terminating');
      c.terminate();
    });
  });
});

test('Operative pool:2', function(done) {
  var c = operative.pool(2, {
    exec: function(cb) {
      for (var i = 0; i < 18; i++) {
        this.computation(function(){});
      }
      cb();
    },
    computation: computation
  });
  var completed = 0;
  function check() {
    completed++;
    if (completed === 2) {
      done(function() {
        console.log('Terminating');
        c.terminate();
      });
    }
  }
  c.next().exec(check);
  c.next().exec(check);
});

test('Operative pool:4', function(done) {
  var c = operative.pool(4, {
    exec: function(cb) {
      for (var i = 0; i < 9; i++) {
        this.computation(function(){});
      }
      cb();
    },
    computation: computation
  });
  var completed = 0;
  function check() {
    completed++;
    if (completed === 4) {
      done(function() {
        console.log('Terminating');
        c.terminate();
      });
    }
  }
  c.next().exec(check);
  c.next().exec(check);
  c.next().exec(check);
  c.next().exec(check);
});

test('4 M/B w/o transfer', function(done) {
  var o = operative(function(d, cb) {
    cb();
  });

  o(new Uint8Array(1024*1024*4), function() {
    done()
  });
});

test('4 M/B w/ transfer', function(done) {
  var o = operative(function(d, cb) {
    cb();
  });

  var arr = new Uint8Array(1024*1024*4);

  o.transfer(arr.buffer, [arr.buffer], function() {
    done();
  });
});