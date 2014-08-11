var test = require('tape');
var operative = require('../src/operative');

function waitsFor(condition, fn) {
  var i = setInterval(function() {
    if (condition()) {
      clearInterval(i);
      fn();
    }
  }, 50);
}

test('Does someothing', function(t) {

  t.plan(1);

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

  o.doAsyncFoo(function(v) { result.push(v); });
  o.doAsyncBar(function(v) { result.push(v); });

  waitsFor(function() {
    return result.length === 2;
  }, function() {
    t.deepEqual(result, [456, 123]);
  });

});