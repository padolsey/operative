# Operative

**Before reading this please ensure you fully understand [the concept of Web Workers](https://developer.mozilla.org/en-US/docs/Web/Guide/Performance/Using_web_workers)**.

Operative is a small JS utility (1k *gzipped*) for seamlessly creating Web Worker scripts. Its features include:

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
	add: function(a, b) {
		return a + b;
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
		return something + 456;
	}
});
```

*(the something variable won't exist within the Worker)*

Instead you can do:

```js
var myWorker = operative({
	something: 123,
	doStuff: function() {
		return this.something + 456;
	}
});
```

### Need to iterate 10,000,000,000 times? No problem!

```js
var craziness = operative({

	doCrazy: function() {

		console.time('Craziness');
		for (var i = 0; i < 10000000000; ++i);
		console.timeEnd('Craziness');

		return 'I am done!';
	}

});

craziness.doCrazy(function(result) {
	// Console outputs: Craziness: 14806.419ms 
	result; // => "I am done!"
});
```

### Browser Support for Workers

[Blob support](http://caniuse.com/#feat=filereader) and [Worker support](http://caniuse.com/#feat=webworkers) (with object-passing):

 * IE10+
 * FF 21+
 * Chrome 26+
 * Safari 6+
 * iOS Safari 6+
 * Opera 15+

### Degraded Operative

Operative will degrade in environments with no Worker or Blob support. In such a case the code would execute as regular in-place JavaScript. The calls will still be asynchronous though, not immediate.

If you are looking to support this degraded state (honestly, only do it if you have to) then you'll also need to avoid utilising Worker-specific APIs like `importScripts`.

### Operative API

 * *{Function}* *operative*: A global function which creates a new Operative module with the passed methods/properties. Note: Non-function properties must be basic objects that can be passed to `JSON.stringify`.
 * *{Boolean}* *operative.hasWorkerSupport*: A boolean indicating whether both Blob and Worker support is detected.

To create an operative module:

```js
var myOperative = operative({
	doX: function(a, b, c) {
		// ...
	},
	doY: function(a, b, c) {
		// ...
	}
});
```

On a given operative module you can call your methods directly, e.g.

```js
myOperative.doX(function(result) {
	// This function'll be called when doX() completes within the worker
	result; // => Whatever doX() returns
});
```

And to destroy the operative (and thus its worker):

```js
o.destroy();
```

