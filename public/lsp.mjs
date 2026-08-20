// Compiles a dart2wasm-generated main module from `source` which can then
// be instantiated via the `instantiate` method.
//
// `source` needs to be a `Response` object (or promise thereof) e.g. created
// via the `fetch()` JS API.
export async function compileStreaming(source) {
  const builtins = {builtins: ['js-string']};
  return new CompiledApp(
      await WebAssembly.compileStreaming(source, builtins), builtins);
}

// Compiles a dart2wasm-generated wasm module from `bytes` which is then
// instantiable via the `instantiate` method.
export async function compile(bytes) {
  const builtins = {builtins: ['js-string']};
  return new CompiledApp(await WebAssembly.compile(bytes, builtins), builtins);
}

class CompiledApp {
  constructor(module, builtins) {
    this.module = module;
    this.builtins = builtins;
  }

  // The second argument is an options object containing:
  // `loadDeferredModules` is a JS function that takes an array of module names
  //   matching wasm files produced by the dart2wasm compiler. It also takes a
  //   callback that should be invoked for each loaded module with 2 arguments:
  //   (1) the module name, (2) the loaded module in a format supported by
  //   `WebAssembly.compile` or `WebAssembly.compileStreaming`. The callback
  //   returns a Promise that resolves when the module is instantiated.
  //   loadDeferredModules should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  // `loadDeferredId` is a JS function that takes load ID produced by the
  //   compiler when the `use-load-ids` option is passed. Each load ID maps to
  //   one or more wasm files as specified in the emitted JSON file. It also
  //   takes a callback that should be invoked for each loaded module with 2
  //   arguments: (1) the module name, (2) the loaded module in a format
  //   supported by `WebAssembly.compile` or `WebAssembly.compileStreaming`.
  //   The callback returns a Promise that resolves when the module is
  //   instantiated.
  //   loadDeferredId should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  async instantiate(additionalImports, {loadDeferredModules, loadDeferredId} = {}) {
    let dartInstance;

    // Prints to the console
    function printToConsole(value) {
      if (typeof dartPrint == "function") {
        dartPrint(value);
        return;
      }
      if (typeof console == "object" && typeof console.log != "undefined") {
        console.log(value);
        return;
      }
      if (typeof print == "function") {
        print(value);
        return;
      }

      throw "Unable to print message: " + value;
    }

    // A special symbol attached to functions that wrap Dart functions.
    const jsWrappedDartFunctionSymbol = Symbol("JSWrappedDartFunction");

    function finalizeWrapper(dartFunction, wrapped) {
      wrapped.dartFunction = dartFunction;
      wrapped[jsWrappedDartFunctionSymbol] = true;
      return wrapped;
    }

    // Imports
    const dart2wasm = {
            AB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmI8ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      AC: Function.prototype.call.bind(DataView.prototype.getUint16),
      AD: a => a.pop(),
      AE: x0 => x0.body,
      B: s => printToConsole(s),
      BB: () => {
        // On browsers return `globalThis.location.href`
        if (globalThis.location != null) {
          return globalThis.location.href;
        }
        return null;
      },
      BC: o => o instanceof Int16Array,
      BD: (s) => +s,
      BE: o => {
        if (o === null || o === undefined) return 0;
        if (typeof(o) === 'string') return 1;
        return 2;
      },
      C: Function.prototype.call.bind(Number.prototype.toString),
      CB: (x0,x1) => x0.postMessage(x1),
      CC: Function.prototype.call.bind(DataView.prototype.setInt16),
      CD: o => o.byteLength,
      CE: x0 => x0.headers,
      D: Function.prototype.call.bind(String.prototype.indexOf),
      DB: () => ({}),
      DC: Function.prototype.call.bind(DataView.prototype.getInt16),
      DD: (ms, c) =>
      setInterval(() => dartInstance.exports.$invokeCallback(c), ms),
      DE: x0 => x0.signal,
      E: o => o,
      EB: (o, p, v) => o[p] = v,
      EC: o => o instanceof Uint8ClampedArray,
      ED: () => Date.now(),
      EE: (o, p) => o[p],
      F: s => JSON.stringify(s),
      FB: () => [],
      FC: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Uint8Array) return 1;
        return 2;
      },
      FD: (handle) => clearInterval(handle),
      FE: (o) => {
        const typeofValue = typeof o;
        return (typeofValue === 'object') ||
            typeofValue === 'function';
      },
      G: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'number') return 1;
        return 2;
      },
      GB: (a, i) => a.push(i),
      GC: Function.prototype.call.bind(DataView.prototype.setInt8),
      GD: (handle) => clearTimeout(handle),
      GE: x0 => x0.data,
      H: x0 => x0.index,
      HB: x0 => x0.random(),
      HC: Function.prototype.call.bind(DataView.prototype.getInt8),
      HD: (o, offsetInBytes, lengthInBytes) => {
        var dst = new ArrayBuffer(lengthInBytes);
        new Uint8Array(dst).set(new Uint8Array(o, offsetInBytes, lengthInBytes));
        return new DataView(dst);
      },
      HE: () => globalThis,
      I: (exn) => {
        let stackString = exn.toString();
        let frames = stackString.split('\n');
        let drop = 4;
        if (frames[0].startsWith('Error')) {
            drop += 1;
        }
        return frames.slice(drop).join('\n');
      },
      IB: () => globalThis.Math,
      IC: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Int8Array) return 1;
        return 2;
      },
      ID: (a, s, e) => a.slice(s, e),
      J: () => new Error().stack,
      JB: b => !!b,
      JC: (o, start, length) => new Float64Array(o.buffer, o.byteOffset + start, length),
      JD: (map, o, v) => map.set(o, v),
      K: o => String(o),
      KB: x0 => new Int8Array(x0),
      KC: (o, start, length) => new Float32Array(o.buffer, o.byteOffset + start, length),
      KD: (map, o) => map.get(o),
      L: o => o === undefined,
      LB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmI8ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      LC: (o, start, length) => new Uint32Array(o.buffer, o.byteOffset + start, length),
      LD: () => new WeakMap(),
      M: (x0,x1) => x0.exec(x1),
      MB: x0 => new Uint8Array(x0),
      MC: (o, start, length) => new Int32Array(o.buffer, o.byteOffset + start, length),
      MD: (a, i) => a.splice(i, 1)[0],
      N: (x0,x1) => { x0.lastIndex = x1 },
      NB: x0 => new Uint8ClampedArray(x0),
      NC: (o, start, length) => new Uint16Array(o.buffer, o.byteOffset + start, length),
      ND: (a, l) => a.length = l,
      O: o => o,
      OB: x0 => new Int16Array(x0),
      OC: (o, start, length) => new Int16Array(o.buffer, o.byteOffset + start, length),
      OD: s => s.trimRight(),
      P: (s, m) => {
        try {
          return new RegExp(s, m);
        } catch (e) {
          return String(e);
        }
      },
      PB: x0 => new Uint16Array(x0),
      PC: (o, start, length) => new Uint8ClampedArray(o.buffer, o.byteOffset + start, length),
      PD: (d, digits) => d.toFixed(digits),
      Q: o => o instanceof RegExp,
      QB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmI16ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      QC: (o, start, length) => new Int8Array(o.buffer, o.byteOffset + start, length),
      QD: x0 => x0.protocol,
      R: (string, times) => string.repeat(times),
      RB: x0 => new Int32Array(x0),
      RC: (ms, c) =>
      setTimeout(() => dartInstance.exports.$invokeCallback(c),ms),
      RD: (x0,x1,x2) => x0.close(x1,x2),
      S: (s, p, i) => s.lastIndexOf(p, i),
      SB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmI32ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      SC: s => new Date(s * 1000).getTimezoneOffset() * 60,
      SD: x0 => x0.close(),
      T: o => o,
      TB: x0 => new Uint32Array(x0),
      TC: Date.now,
      TD: (x0,x1) => x0.send(x1),
      U: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'boolean') return 1;
        return 2;
      },
      UB: x0 => new Float32Array(x0),
      UC: s => s.trim(),
      UD: () => new Array(),
      V: x0 => x0.dotAll,
      VB: x0 => new Float64Array(x0),
      VC: (a, b) => a == b ? 0 : (a > b ? 1 : -1),
      VD: (x0,x1) => new WebSocket(x0,x1),
      W: x0 => x0.unicode,
      WB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const getValue = dartInstance.exports.$wasmF64ArrayGet;
        for (let i = 0; i < length; i++) {
          jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
        }
      },
      WC: s => {
        if (!/^\s*[+-]?(?:Infinity|NaN|(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?)\s*$/.test(s)) {
          return NaN;
        }
        return parseFloat(s);
      },
      WD: x0 => x0.reason,
      X: x0 => x0.ignoreCase,
      XB: x0 => new ArrayBuffer(x0),
      XC: () => typeof dartUseDateNowForTicks !== "undefined",
      XD: x0 => x0.code,
      Y: x0 => x0.multiline,
      YB: (x0,x1,x2) => new Uint8Array(x0,x1,x2),
      YC: () => Date.now(),
      YD: (x0,x1,x2,x3) => x0.addEventListener(x1,x2,x3),
      Z: Function.prototype.call.bind(Number.prototype.toString),
      ZB: (x0,x1,x2) => new DataView(x0,x1,x2),
      ZC: () => 1000 * performance.now(),
      ZD: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      a: Function.prototype.call.bind(BigInt.prototype.toString),
      aB: (o, p) => o[p],
      aC: x0 => new WeakRef(x0),
      aD: (x0,x1,x2,x3) => x0.removeEventListener(x1,x2,x3),
      b: (exn) => {
        if (exn instanceof Error) {
          return exn.stack;
        } else {
          return null;
        }
      },
      bB: x0 => new Array(x0),
      bC: x0 => x0.deref(),
      bD: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      c: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      cB: (x0,x1,x2) => { x0[x1] = x2 },
      cC: () => globalThis.WeakRef,
      cD: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof ArrayBuffer) return 1;
        if (globalThis.SharedArrayBuffer !== undefined &&
            o instanceof SharedArrayBuffer) {
          return 2;
        }
        return 3;
      },
      d: (x0,x1) => { x0.onmessage = x1 },
      dB: (o) => new DataView(o.buffer, o.byteOffset, o.byteLength),
      dC: (o, p) => p in o,
      dD: (o, c) => o instanceof c,
      e: (c) =>
      queueMicrotask(() => dartInstance.exports.$invokeCallback(c)),
      eB: Function.prototype.call.bind(Object.getOwnPropertyDescriptor(DataView.prototype, 'byteLength').get),
      eC: o => typeof o === 'function' && o[jsWrappedDartFunctionSymbol] === true,
      eD: (o, t) => typeof o === t,
      f: (l, r) => l === r,
      fB: o => o.byteOffset,
      fC: f => f.dartFunction,
      fD: x0 => x0.readyState,
      g: (x0,x1) => x0[x1],
      gB: Function.prototype.call.bind(DataView.prototype.setFloat64),
      gC: (wasmFunction,f) => finalizeWrapper(f, function(x0) { return wasmFunction(f,arguments.length,x0) }),
      gD: (x0,x1) => { x0.binaryType = x1 },
      h: (o, p, r) => o.replace(p, () => r),
      hB: o => o.buffer,
      hC: (wasmFunction,f) => finalizeWrapper(f, function(x0,x1) { return wasmFunction(f,arguments.length,x0,x1) }),
      hD: o => [o],
      i: (o, p, r) => o.replaceAll(p, () => r),
      iB: Function.prototype.call.bind(DataView.prototype.getUint8),
      iC: (p, s, f) => p.then(s, (e) => f(e, e === undefined)),
      iD: (o0, o1) => [o0, o1],
      j: Function.prototype.call.bind(String.prototype.toLowerCase),
      jB: Function.prototype.call.bind(DataView.prototype.setUint8),
      jC: (o, i) => o[i],
      jD: (o0, o1, o2) => [o0, o1, o2],
      k: Object.is,
      kB: (b, o) => new DataView(b, o),
      kC: o => o.length,
      kD: (o0, o1, o2, o3) => [o0, o1, o2, o3],
      l: x0 => x0.pop(),
      lB: (b, o, l) => new DataView(b, o, l),
      lC: o => {
        if (o === undefined) return 1;
        var type = typeof o;
        if (type === 'boolean') return 2;
        if (type === 'number') return 3;
        if (type === 'string') return 4;
        if (o instanceof Array) return 5;
        if (ArrayBuffer.isView(o)) {
          if (o instanceof Int8Array) return 6;
          if (o instanceof Uint8Array) return 7;
          if (o instanceof Uint8ClampedArray) return 8;
          if (o instanceof Int16Array) return 9;
          if (o instanceof Uint16Array) return 10;
          if (o instanceof Int32Array) return 11;
          if (o instanceof Uint32Array) return 12;
          if (o instanceof Float32Array) return 13;
          if (o instanceof Float64Array) return 14;
          if (o instanceof DataView) return 15;
        }
        if (o instanceof ArrayBuffer) return 16;
        // Feature check for `SharedArrayBuffer` before doing a type-check.
        if (globalThis.SharedArrayBuffer !== undefined &&
            o instanceof SharedArrayBuffer) {
            return 17;
        }
        if (o instanceof Promise) return 18;
        return 19;
      },
      lD: () => new AbortController(),
      m: x0 => x0.flags,
      mB: Function.prototype.call.bind(DataView.prototype.getFloat64),
      mC: x0 => x0.groups,
      mD: (x0,x1,x2,x3,x4,x5) => ({method: x0,headers: x1,body: x2,credentials: x3,redirect: x4,signal: x5}),
      n: (x0,x1) => x0.test(x1),
      nB: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Float64Array) return 1;
        return 2;
      },
      nC: (a, i) => a.splice(i, 1),
      nD: (x0,x1) => globalThis.fetch(x0,x1),
      o: (decoder, codeUnits) => decoder.decode(codeUnits),
      oB: (t, s) => t.set(s),
      oC: x0 => x0.clearMarks(),
      oD: (x0,x1) => x0.get(x1),
      p: (o, start, length) => new Uint8Array(o.buffer, o.byteOffset + start, length),
      pB: Function.prototype.call.bind(DataView.prototype.setFloat32),
      pC: x0 => x0.clearMeasures(),
      pD: (wasmFunction,f) => finalizeWrapper(f, function(x0,x1,x2) { return wasmFunction(f,arguments.length,x0,x1,x2) }),
      q: () => new TextDecoder("utf-8", {fatal: true}),
      qB: Function.prototype.call.bind(DataView.prototype.getFloat32),
      qC: (x0,x1) => x0.parse(x1),
      qD: (x0,x1) => x0.forEach(x1),
      r: () => new TextDecoder("utf-8", {fatal: false}),
      rB: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Float32Array) return 1;
        return 2;
      },
      rC: (x0,x1,x2) => x0.mark(x1,x2),
      rD: x0 => x0.name,
      s: x0 => x0.length,
      sB: Function.prototype.call.bind(DataView.prototype.setUint32),
      sC: (x0,x1,x2,x3) => x0.measure(x1,x2,x3),
      sD: x0 => x0.statusText,
      t: (string, token) => string.split(token),
      tB: Function.prototype.call.bind(DataView.prototype.getUint32),
      tC: () => globalThis.JSON,
      tD: x0 => x0.url,
      u: o => o instanceof Array,
      uB: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Uint32Array) return 1;
        return 2;
      },
      uC: x0 => x0.clearMarks,
      uD: x0 => x0.status,
      v: (a, i) => a[i],
      vB: Function.prototype.call.bind(DataView.prototype.setInt32),
      vC: x0 => x0.clearMeasures,
      vD: x0 => x0.cancel(),
      w: a => a.length,
      wB: Function.prototype.call.bind(DataView.prototype.getInt32),
      wC: x0 => x0.mark,
      wD: x0 => x0.getReader(),
      x: () => {
        return typeof process != "undefined" &&
               Object.prototype.toString.call(process) == "[object process]" &&
               process.platform == "win32"
      },
      xB: o => {
        if (o === null || o === undefined) return 0;
        if (o instanceof Int32Array) return 1;
        return 2;
      },
      xC: x0 => x0.measure,
      xD: x0 => x0.read(),
      y: s => s.toUpperCase(),
      yB: o => o instanceof Uint16Array,
      yC: () => globalThis.performance,
      yD: x0 => x0.value,
      z: (a, i, v) => a[i] = v,
      zB: Function.prototype.call.bind(DataView.prototype.setUint16),
      zC: (a, s) => a.join(s),
      zD: x0 => x0.done,

    };

    const baseImports = {
      _: dart2wasm,
      Math: Math,
      Date: Date,
      Object: Object,
      Array: Array,
      Reflect: Reflect,
      WebAssembly: {
        JSTag: WebAssembly.JSTag,
      },
      "": new Proxy({}, { get(_, prop) { return prop; } }),

    };

    const jsStringPolyfill = {
      "charCodeAt": (s, i) => s.charCodeAt(i),
      "compare": (s1, s2) => {
        if (s1 < s2) return -1;
        if (s1 > s2) return 1;
        return 0;
      },
      "concat": (s1, s2) => s1 + s2,
      "equals": (s1, s2) => s1 === s2,
      "fromCharCode": (i) => String.fromCharCode(i),
      "length": (s) => s.length,
      "substring": (s, a, b) => s.substring(a, b),
      "fromCharCodeArray": (a, start, end) => {
        if (end <= start) return '';

        const read = dartInstance.exports.$wasmI16ArrayGet;
        let result = '';
        let index = start;
        const chunkLength = Math.min(end - index, 500);
        let array = new Array(chunkLength);
        while (index < end) {
          const newChunkLength = Math.min(end - index, 500);
          for (let i = 0; i < newChunkLength; i++) {
            array[i] = read(a, index++);
          }
          if (newChunkLength < chunkLength) {
            array = array.slice(0, newChunkLength);
          }
          result += String.fromCharCode(...array);
        }
        return result;
      },
      "intoCharCodeArray": (s, a, start) => {
        if (s === '') return 0;

        const write = dartInstance.exports.$wasmI16ArraySet;
        for (var i = 0; i < s.length; ++i) {
          write(a, start++, s.charCodeAt(i));
        }
        return s.length;
      },
      "test": (s) => typeof s == "string",
    };


    

    dartInstance = await WebAssembly.instantiate(this.module, {
      ...baseImports,
      ...additionalImports,
      
      "wasm:js-string": jsStringPolyfill,
    });

    return new InstantiatedApp(this, dartInstance);
  }
}

class InstantiatedApp {
  constructor(compiledApp, instantiatedModule) {
    this.compiledApp = compiledApp;
    this.instantiatedModule = instantiatedModule;
  }

  // Call the main function with the given arguments.
  invokeMain(...args) {
    this.instantiatedModule.exports.$invokeMain(args);
  }
}
