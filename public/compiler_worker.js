(() => {
  // ../web/compiler.mjs
  async function compileStreaming(source) {
    const builtins = { builtins: ["js-string"] };
    return new CompiledApp(
      await WebAssembly.compileStreaming(source, builtins),
      builtins
    );
  }
  var CompiledApp = class {
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
    async instantiate(additionalImports, { loadDeferredModules, loadDeferredId } = {}) {
      let dartInstance;
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
      const jsWrappedDartFunctionSymbol = Symbol("JSWrappedDartFunction");
      function finalizeWrapper(dartFunction, wrapped) {
        wrapped.dartFunction = dartFunction;
        wrapped[jsWrappedDartFunctionSymbol] = true;
        return wrapped;
      }
      const dart2wasm = {
        AB: (x0) => new Int32Array(x0),
        AC: () => typeof dartUseDateNowForTicks !== "undefined",
        AD: (x0) => x0.clearMeasures,
        B: (s) => printToConsole(s),
        BB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const getValue = dartInstance.exports.$wasmI32ArrayGet;
          for (let i = 0; i < length; i++) {
            jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
          }
        },
        BC: () => Date.now(),
        BD: (x0) => x0.mark,
        C: Function.prototype.call.bind(Number.prototype.toString),
        CB: (x0) => new Uint32Array(x0),
        CC: () => 1e3 * performance.now(),
        CD: (x0) => x0.measure,
        D: Function.prototype.call.bind(String.prototype.indexOf),
        DB: (x0) => new Float32Array(x0),
        DC: (l, r) => l === r,
        DD: () => globalThis.performance,
        E: (o) => o,
        EB: (x0) => new Float64Array(x0),
        EC: (x0) => x0.pop(),
        ED: (ms, c) => setTimeout(() => dartInstance.exports.$invokeCallback(c), ms),
        F: (s) => JSON.stringify(s),
        FB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const getValue = dartInstance.exports.$wasmF64ArrayGet;
          for (let i = 0; i < length; i++) {
            jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
          }
        },
        FC: (x0) => x0.flags,
        FD: (x0, x1) => x0.getFileHandle(x1),
        G: (o) => {
          if (o === void 0 || o === null) return 0;
          if (typeof o === "number") return 1;
          return 2;
        },
        GB: (x0) => new ArrayBuffer(x0),
        GC: (x0, x1) => x0[x1],
        GD: (x0) => x0.createSyncAccessHandle(),
        H: (x0) => x0.index,
        HB: (x0, x1, x2) => new Uint8Array(x0, x1, x2),
        HC: (x0, x1) => x0.test(x1),
        HD: (x0) => x0.getSize(),
        I: (exn) => {
          let stackString = exn.toString();
          let frames = stackString.split("\n");
          let drop = 4;
          if (frames[0].startsWith("Error")) {
            drop += 1;
          }
          return frames.slice(drop).join("\n");
        },
        IB: (x0, x1, x2) => new DataView(x0, x1, x2),
        IC: (decoder, codeUnits) => decoder.decode(codeUnits),
        ID: (x0, x1) => x0.read(x1),
        J: () => new Error().stack,
        JB: (o, p) => o[p],
        JC: () => new TextDecoder("utf-8", { fatal: true }),
        JD: (x0) => x0.close(),
        K: (o) => String(o),
        KB: (o) => new DataView(o.buffer, o.byteOffset, o.byteLength),
        KC: () => new TextDecoder("utf-8", { fatal: false }),
        KD: (x0) => ({ create: x0 }),
        L: (o) => o === void 0,
        LB: Function.prototype.call.bind(Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength").get),
        LC: (string, token) => string.split(token),
        LD: (x0, x1, x2) => x0.getDirectoryHandle(x1, x2),
        M: (x0, x1) => x0.exec(x1),
        MB: (o) => o.byteOffset,
        MC: (o) => o instanceof Array,
        MD: (s) => new Date(s * 1e3).getTimezoneOffset() * 60,
        N: (x0, x1) => {
          x0.lastIndex = x1;
        },
        NB: (o) => o.buffer,
        NC: (a, i, v) => a[i] = v,
        ND: Date.now,
        O: (o) => o,
        OB: (b, o) => new DataView(b, o),
        OC: (a, i) => a[i],
        OD: (o) => o.byteLength,
        P: (s, m) => {
          try {
            return new RegExp(s, m);
          } catch (e) {
            return String(e);
          }
        },
        PB: (b, o, l) => new DataView(b, o, l),
        PC: (a) => a.length,
        PD: (o, offsetInBytes, lengthInBytes) => {
          var dst = new ArrayBuffer(lengthInBytes);
          new Uint8Array(dst).set(new Uint8Array(o, offsetInBytes, lengthInBytes));
          return new DataView(dst);
        },
        Q: (o) => o instanceof RegExp,
        QB: Function.prototype.call.bind(DataView.prototype.getFloat64),
        QC: () => {
          return typeof process != "undefined" && Object.prototype.toString.call(process) == "[object process]" && process.platform == "win32";
        },
        QD: (a, s, e) => a.slice(s, e),
        R: (string, times) => string.repeat(times),
        RB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Float64Array) return 1;
          return 2;
        },
        RC: (s) => s.toUpperCase(),
        RD: (d, digits) => d.toFixed(digits),
        S: (s, p, i) => s.lastIndexOf(p, i),
        SB: Function.prototype.call.bind(DataView.prototype.setFloat64),
        SC: Object.is,
        SD: (x0) => x0.length,
        T: (o) => o,
        TB: (t, s) => t.set(s),
        TC: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const setValue = dartInstance.exports.$wasmI8ArraySet;
          for (let i = 0; i < length; i++) {
            setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
          }
        },
        TD: (a, i) => a.splice(i, 1)[0],
        U: (o) => {
          if (o === void 0 || o === null) return 0;
          if (typeof o === "boolean") return 1;
          return 2;
        },
        UB: Function.prototype.call.bind(DataView.prototype.setFloat32),
        UC: Function.prototype.call.bind(String.prototype.toLowerCase),
        UD: (x0, x1) => x0.postMessage(x1),
        V: (x0) => x0.dotAll,
        VB: Function.prototype.call.bind(DataView.prototype.getFloat32),
        VC: () => {
          if (globalThis.location != null) {
            return globalThis.location.href;
          }
          return null;
        },
        VD: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof ArrayBuffer) return 1;
          if (globalThis.SharedArrayBuffer !== void 0 && o instanceof SharedArrayBuffer) {
            return 2;
          }
          return 3;
        },
        W: (x0) => x0.unicode,
        WB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Float32Array) return 1;
          return 2;
        },
        WC: (o, p) => p in o,
        WD: (x0) => x0.getDirectory(),
        X: (x0) => x0.ignoreCase,
        XB: Function.prototype.call.bind(DataView.prototype.setUint32),
        XC: (o) => typeof o === "function" && o[jsWrappedDartFunctionSymbol] === true,
        XD: (o, p) => o[p],
        Y: (x0) => x0.multiline,
        YB: Function.prototype.call.bind(DataView.prototype.getUint32),
        YC: (f) => f.dartFunction,
        YD: (o) => {
          const typeofValue = typeof o;
          return typeofValue === "object" || typeofValue === "function";
        },
        Z: Function.prototype.call.bind(Number.prototype.toString),
        ZB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Uint32Array) return 1;
          return 2;
        },
        ZC: (wasmFunction, f) => finalizeWrapper(f, function(x0) {
          return wasmFunction(f, arguments.length, x0);
        }),
        ZD: (x0) => x0.data,
        a: Function.prototype.call.bind(BigInt.prototype.toString),
        aB: Function.prototype.call.bind(DataView.prototype.setInt32),
        aC: (wasmFunction, f) => finalizeWrapper(f, function(x0, x1) {
          return wasmFunction(f, arguments.length, x0, x1);
        }),
        aD: () => globalThis,
        b: (exn) => {
          if (exn instanceof Error) {
            return exn.stack;
          } else {
            return null;
          }
        },
        bB: Function.prototype.call.bind(DataView.prototype.getInt32),
        bC: (p, s, f) => p.then(s, (e) => f(e, e === void 0)),
        c: (wasmFunction, f) => finalizeWrapper(f, function(x0) {
          return wasmFunction(f, arguments.length, x0);
        }),
        cB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Int32Array) return 1;
          return 2;
        },
        cC: (o, i) => o[i],
        d: (x0, x1) => {
          x0.onmessage = x1;
        },
        dB: (o) => o instanceof Uint16Array,
        dC: (o) => o.length,
        e: (x0, x1, x2) => x0.postMessage(x1, x2),
        eB: Function.prototype.call.bind(DataView.prototype.setUint16),
        eC: (o) => {
          if (o === void 0) return 1;
          var type = typeof o;
          if (type === "boolean") return 2;
          if (type === "number") return 3;
          if (type === "string") return 4;
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
          if (globalThis.SharedArrayBuffer !== void 0 && o instanceof SharedArrayBuffer) {
            return 17;
          }
          if (o instanceof Promise) return 18;
          return 19;
        },
        f: (c) => queueMicrotask(() => dartInstance.exports.$invokeCallback(c)),
        fB: Function.prototype.call.bind(DataView.prototype.getUint16),
        fC: (x0) => x0.groups,
        g: (x0) => new Array(x0),
        gB: (o) => o instanceof Int16Array,
        gC: (s) => +s,
        h: (o) => [o],
        hB: Function.prototype.call.bind(DataView.prototype.setInt16),
        hC: (s) => {
          if (!/^\s*[+-]?(?:Infinity|NaN|(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?)\s*$/.test(s)) {
            return NaN;
          }
          return parseFloat(s);
        },
        i: (o0, o1) => [o0, o1],
        iB: Function.prototype.call.bind(DataView.prototype.getInt16),
        iC: (s) => s.trim(),
        j: (o0, o1, o2) => [o0, o1, o2],
        jB: (o) => o instanceof Uint8ClampedArray,
        jC: (o, p, r) => o.replace(p, () => r),
        k: (o0, o1, o2, o3) => [o0, o1, o2, o3],
        kB: Function.prototype.call.bind(DataView.prototype.setUint8),
        kC: (o, p, r) => o.replaceAll(p, () => r),
        l: (x0, x1, x2) => {
          x0[x1] = x2;
        },
        lB: Function.prototype.call.bind(DataView.prototype.getUint8),
        lC: (a, l) => a.length = l,
        m: () => ({}),
        mB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Uint8Array) return 1;
          return 2;
        },
        mC: (a, l) => a.length = l,
        n: (o, p, v) => o[p] = v,
        nB: Function.prototype.call.bind(DataView.prototype.setInt8),
        nC: (map, o) => map.get(o),
        o: () => [],
        oB: Function.prototype.call.bind(DataView.prototype.getInt8),
        oC: () => /* @__PURE__ */ new WeakMap(),
        p: (a, i) => a.push(i),
        pB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Int8Array) return 1;
          return 2;
        },
        pC: (a, s) => a.join(s),
        q: (x0) => x0.random(),
        qB: (o, start, length) => new Float64Array(o.buffer, o.byteOffset + start, length),
        qC: (map, o, v) => map.set(o, v),
        r: () => globalThis.Math,
        rB: (o, start, length) => new Float32Array(o.buffer, o.byteOffset + start, length),
        rC: (a, b) => a == b ? 0 : a > b ? 1 : -1,
        s: (b) => !!b,
        sB: (o, start, length) => new Uint32Array(o.buffer, o.byteOffset + start, length),
        sC: (a) => a.pop(),
        t: (x0) => new Int8Array(x0),
        tB: (o, start, length) => new Int32Array(o.buffer, o.byteOffset + start, length),
        tC: (x0) => x0.clearMarks(),
        u: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const getValue = dartInstance.exports.$wasmI8ArrayGet;
          for (let i = 0; i < length; i++) {
            jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
          }
        },
        uB: (o, start, length) => new Uint16Array(o.buffer, o.byteOffset + start, length),
        uC: (x0) => x0.clearMeasures(),
        v: (x0) => new Uint8Array(x0),
        vB: (o, start, length) => new Int16Array(o.buffer, o.byteOffset + start, length),
        vC: (x0, x1) => x0.parse(x1),
        w: (x0) => new Uint8ClampedArray(x0),
        wB: (o, start, length) => new Uint8ClampedArray(o.buffer, o.byteOffset + start, length),
        wC: (x0, x1, x2) => x0.mark(x1, x2),
        x: (x0) => new Int16Array(x0),
        xB: (o, start, length) => new Uint8Array(o.buffer, o.byteOffset + start, length),
        xC: (x0, x1, x2, x3) => x0.measure(x1, x2, x3),
        y: (x0) => new Uint16Array(x0),
        yB: (o, start, length) => new Int8Array(o.buffer, o.byteOffset + start, length),
        yC: () => globalThis.JSON,
        z: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const getValue = dartInstance.exports.$wasmI16ArrayGet;
          for (let i = 0; i < length; i++) {
            jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
          }
        },
        zB: (o, p, v) => o[p] = v,
        zC: (x0) => x0.clearMarks
      };
      const baseImports = {
        _: dart2wasm,
        Math,
        Date,
        Object,
        Array,
        Reflect,
        WebAssembly: {
          JSTag: WebAssembly.JSTag
        },
        "": new Proxy({}, { get(_, prop) {
          return prop;
        } })
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
          if (end <= start) return "";
          const read = dartInstance.exports.$wasmI16ArrayGet;
          let result = "";
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
          if (s === "") return 0;
          const write = dartInstance.exports.$wasmI16ArraySet;
          for (var i = 0; i < s.length; ++i) {
            write(a, start++, s.charCodeAt(i));
          }
          return s.length;
        },
        "test": (s) => typeof s == "string"
      };
      dartInstance = await WebAssembly.instantiate(this.module, {
        ...baseImports,
        ...additionalImports,
        "wasm:js-string": jsStringPolyfill
      });
      return new InstantiatedApp(this, dartInstance);
    }
  };
  var InstantiatedApp = class {
    constructor(compiledApp, instantiatedModule) {
      this.compiledApp = compiledApp;
      this.instantiatedModule = instantiatedModule;
    }
    // Call the main function with the given arguments.
    invokeMain(...args) {
      this.instantiatedModule.exports.$invokeMain(args);
    }
  };

  // public/worker_base.mjs
  function awaitBase(pending2) {
    const buffered = pending2.findIndex(
      (event) => event.data && event.data.type === "boot"
    );
    if (buffered >= 0) {
      const [event] = pending2.splice(buffered, 1);
      return Promise.resolve(event.data.base);
    }
    return new Promise((resolve) => {
      const listener = (event) => {
        if (!event.data || event.data.type !== "boot") return;
        self.removeEventListener("message", listener);
        resolve(event.data.base);
      };
      self.addEventListener("message", listener);
    });
  }

  // public/compiler_worker_src.mjs
  var pending = [];
  var buffer = (event) => pending.push(event);
  self.addEventListener("message", buffer);
  function describe(value) {
    if (value == null) return "";
    const parts = [];
    const message = value.message ?? (typeof value === "string" ? value : "");
    if (message) parts.push(String(message));
    if (value.stack) parts.push(String(value.stack));
    if (!parts.length) {
      const name = value.constructor?.name ?? typeof value;
      parts.push(name === "Object" ? String(value) : `<${name}>`);
    }
    return parts.join(" \u2014 ");
  }
  self.addEventListener("unhandledrejection", (event) => {
    self.postMessage({ type: "boot_error", message: describe(event.reason) });
  });
  (async () => {
    try {
      const base = await awaitBase(pending);
      const wasmUrl = new URL("toolchain/compiler.wasm", base).toString();
      const app = await compileStreaming(fetch(wasmUrl));
      const instance = await app.instantiate({});
      instance.invokeMain();
      self.removeEventListener("message", buffer);
      self.postMessage({ type: "booted", replayed: pending.length });
      for (const event of pending) self.onmessage(event);
    } catch (error) {
      self.postMessage({ type: "boot_error", message: describe(error) });
    }
  })();
})();
//# sourceMappingURL=compiler_worker.js.map
