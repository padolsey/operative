# Operative

**Before reading this please ensure you fully understand [the concept of Web Workers](https://developer.mozilla.org/en-US/docs/Web/Guide/Performance/Using_web_workers)**.

Operative is a small JS utility (~1.8k *gzipped*) for seamlessly creating Web Worker scripts. Its features include:

 * Seamless API Authoring
 * Producing debuggable Worker Blobs
 * Providing `console` interface for simple logging
 * Degrading where Worker/Blob support is lacking

### Why Operative?

Utilising unabstracted Workers can be cumbersome and awkward. Having to design and implement message-passing contracts and having to setup event listeners yourself is time-consuming and error-prone. Operative takes care of this stuff so you can focus on your code.

### Before you get excited:

Even with Operative you are still subject to the constraints of Web Workers, i.e.

 * No DOM/BOM Access
 * No syncronous communication with parent page

### Creating an Operative Module

An Operative module is defined as an object containing properties/methods:

```js
var calculator = operative({
	add: function(a, b, cb) {
		cb( a + b );
	}
});
```

This would expose an asynchronous API:

```js
calculator.add(1, 2, function(result) {
	result; // => 3
});
```

The `add()` function will run within a worker. The value it returns is handled by operative and forwarded, asynchronously to your callback function in the parent page.

Notice that the exposed `add` method requires its last argument to be a callback. The last argument passed to an operative method must always be a callback. All preceeding arguments are passed into the worker itself.

**NOTE:** It's important to note that the Operative code is not executed in-place. *It's executed within a Worker. You won't be able to access variables surrounding the definition of your operative:

```js
// THIS WILL NOT WORK!

var something = 123;

var myWorker = operative({
	doStuff: function() {
		something += 456;
	}
});
```

*(the something variable won't exist within the Worker)*

Instead you can do:

```js
var myWorker = operative({
	something: 123,
	doStuff: function() {
		this.something += 456;
	}
});
```

### Need to iterate 10,000,000,000 times? No problem!

```js
var craziness = operative({

	doCrazy: function(cb) {

		console.time('Craziness');
		for (var i = 0; i < 10000000000; ++i);
		console.timeEnd('Craziness');

		cb('I am done!');
	}

});

craziness.doCrazy(function(result) {
	// Console outputs: Craziness: 14806.419ms 
	result; // => "I am done!"
});
```

### Browser Support for Workers

 * FF 17+
 * Chrome 7+
 * Safari 4+
 * Opera 11+
 * IE10+

### Degraded Operative

Operative degrades in this order:

*(higher is better/cooler)*

 * Full Worker via Blob & [Structured-Cloning](https://developer.mozilla.org/en-US/docs/Web/Guide/DOM/The_structured_clone_algorithm?redirectlocale=en-US&redirectslug=DOM%2FThe_structured_clone_algorithm) (Ch13+, FF8+, IE11+, Op11.5+, Sf5.1+)
 * Full Worker via Eval & [Structured-Cloning](https://developer.mozilla.org/en-US/docs/Web/Guide/DOM/The_structured_clone_algorithm?redirectlocale=en-US&redirectslug=DOM%2FThe_structured_clone_algorithm) (IE10)
 * Full Worker via Blob & JSON marshalling *(???)*
 * Full Worker via Eval & JSON marshalling (Sf4)
 * No Worker: Regular JS called inline (*older browsers*)

Operative will degrade in environments with no Worker or Blob support. In such a case the code would execute as regular in-place JavaScript. The calls will still be asynchronous though, not immediate.

If you are looking to support this fully degraded state (honestly, only do it if you have to) then you'll also need to avoid utilising Worker-specific APIs like `importScripts`.

### No Worker-Via-Blob Support

Operative supports browsers with no worker-via-blob support (e.g. IE10, Safari 4.0) via eval, and it requires `operative.js` or `operative.min.js` to be its own file and included in the page via a `<script>` tag. Or, alternatively, if its bundled with other JS, you'll have to have an additional `operative.js` and specify it *before creating an operative module* via `operative.setSelfURL('path/to/operative.js')` (this'll only generate a request where the aforementioned support is lacking). Due to the usage of eval in these cases it is recommended to debug your operatives in more capable browsers.

### Operative API Documentation

 * *{Function}* *operative*: A global function which creates a new Operative module with the passed methods/properties. Note: Non-function properties must be basic objects that can be passed to `JSON.stringify`.
  * Pass an object of methods, e.g. `operative({ method: function() {...} ... });`
  * Or pass a single function, e.g. `operative(function() {})` (*in which case a single function is returned*)
 * *{Boolean}* *operative.hasWorkerSupport*: A boolean indicating whether both Blob and Worker support is detected.
 * *{Function}* *operative.setSelfURL*: Allows you to set the URL of the operative script. Use this if you want IE10 & Safari 4/5 support *and* you're not including operative by the conventional `<script src="operative.js"></script>`.

 #### Creating an Operative:

To create an operative module pass an object of methods/properties:

```js
var myOperative = operative({
	doX: function(a, b, c, callback) {
		// ...
	},
	doY: function(a, b, c, callback) {
		// ...
	}
});
```

Or a single function to create a singular operative:

```js
var myOperative = operative(function(a, b, c, callback) {
	// Send the result to the parent page:
	callback(...);
});

// Example call:
myOperative(1, 2, 3, function() { /*callback*/ });
```

#### Returning results

The most simple way to use operative is to pass in a callback function when calling an operative function and within the operative method call the callback with your result:

```js
var combine = operative(function(foo, bar, callback) {
	callback(foo + bar);
});

combine('foo', 'bar', function() {
	// This callback function will be called with
	// the result from your operative function.
	result; // => 'foobar'
});
```

#### Return via Promises

If you don't pass a callback when calling an operative method, operative will assume you want a Promise. Note that operative will reference `operative.Promise` and will expect it to be a [native Promise implementation](http://dom.spec.whatwg.org/#promises) or [compliant polyfill](https://github.com/slightlyoff/Promises). *Operative does not come bundled with a Promise implementation.*

```js
var combine = operative(function(foo, bar) {
	// Internally, use a Deferred:
	var deferred = this.deferred();

	// A deferred has two methods: fulfill & reject:

	if (foo !== 'foo') {
		// Error (Rejection)
		deferred.reject('foo should be "foo"!');
	} else {
		// Success (Filfillment)
		deferred.fulfill(foo + bar);
	}
});

// Usage externally:
var promise = combine('foo', 'bar');

promise.then(function(value) {
	// Fulfilled
}, function(err) {
	// Rejected
});
```

**NOTE:** Operative will only give you a promise if you don't pass a callback *and* if `operative.Promise` is defined. By default `operative.Promise` will reference `window.Promise` (*native implementation if it exists*).

#### Destroying an operative

To destroy the operative (and thus its worker):

```js
o.destroy();
```

### Testing & Building

```
$ # grab dependencies
$ npm install

$ # install grunt globally if you don't have it...
$ npm install -g grunt-cli

$ # test
$ grunt test

$ # do everything + build dist:
$ grunt
```

### Changelog

 * 0.1.0 (25 Jul 2013) Support Promises (from [Issue #3](https://github.com/padolsey/operative/issues/3)) if they're provided by a [native Promise implementation](http://dom.spec.whatwg.org/#promises) or [compliant polyfill](https://github.com/slightlyoff/Promises). Also added support for `operative(Function)` which returns a single function.
 * 0.0.3 (18 Jul 2013) Support for asynchronous returning from within operartive methods (via `this.async()`).
 * 0.0.2 (12 Jul 2013) Improved browser support: IE10 support via eval, degraded JSON-marshalling etc.
 * 0.0.1 (11 Jul 2013) Initial

### Contributors

  * [James Padolsey](https://github.com/padolsey)
  * [Evan Worley](https://github.com/evanworley)
  * [Raynos](https://github.com/Raynos)
