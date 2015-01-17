var operative = require('../src/operative');

operative.setBaseURL(__dirname);

var calc = operative({
  thing: function(a, b) {
    console.log('>>>>', dependency1)
    this.deferred().fulfil(a + b);
  }
}, ['resources/dependency1.js']);

calc.thing(98, 7).then(function(ok) {
  console.log('>>>', ok);
})
