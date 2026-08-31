(() => {
  // ../web/workspace.mjs
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
        AB: (x0, x1) => x0[x1],
        AC: Function.prototype.call.bind(DataView.prototype.getInt32),
        AD: (o) => o.length,
        B: (s) => printToConsole(s),
        BB: (x0) => x0.pop(),
        BC: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Int32Array) return 1;
          return 2;
        },
        BD: (o) => {
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
        C: Function.prototype.call.bind(Number.prototype.toString),
        CB: (x0) => x0.flags,
        CC: (o) => o instanceof Uint16Array,
        CD: (x0, x1) => x0.getFileHandle(x1),
        D: Function.prototype.call.bind(BigInt.prototype.toString),
        DB: Function.prototype.call.bind(String.prototype.toLowerCase),
        DC: Function.prototype.call.bind(DataView.prototype.setUint16),
        DD: (x0) => x0.getSize(),
        E: (exn) => {
          let stackString = exn.toString();
          let frames = stackString.split("\n");
          let drop = 4;
          if (frames[0].startsWith("Error")) {
            drop += 1;
          }
          return frames.slice(drop).join("\n");
        },
        EB: (x0) => x0.length,
        EC: Function.prototype.call.bind(DataView.prototype.getUint16),
        ED: (x0, x1) => x0.read(x1),
        F: () => new Error().stack,
        FB: (x0) => ({ headers: x0 }),
        FC: (o) => o instanceof Int16Array,
        FD: (o, offsetInBytes, lengthInBytes) => {
          var dst = new ArrayBuffer(lengthInBytes);
          new Uint8Array(dst).set(new Uint8Array(o, offsetInBytes, lengthInBytes));
          return new DataView(dst);
        },
        G: (s) => JSON.stringify(s),
        GB: (x0, x1, x2) => x0.fetch(x1, x2),
        GC: Function.prototype.call.bind(DataView.prototype.setInt16),
        GD: (a, s, e) => a.slice(s, e),
        H: Function.prototype.call.bind(Number.prototype.toString),
        HB: (x0, x1) => x0.get(x1),
        HC: Function.prototype.call.bind(DataView.prototype.getInt16),
        HD: (s) => s.trimRight(),
        I: Function.prototype.call.bind(String.prototype.indexOf),
        IB: (s) => new Date(s * 1e3).getTimezoneOffset() * 60,
        IC: (o) => o instanceof Uint8ClampedArray,
        ID: (x0) => x0.arrayBuffer(),
        J: (s, p, i) => s.lastIndexOf(p, i),
        JB: Date.now,
        JC: Function.prototype.call.bind(DataView.prototype.setUint8),
        JD: (o, p) => p in o,
        K: (o) => o,
        KB: (o) => {
          if (o === null || o === void 0) return 0;
          if (typeof o === "string") return 1;
          return 2;
        },
        KC: Function.prototype.call.bind(DataView.prototype.getUint8),
        KD: (x0) => x0.groups,
        L: (o) => {
          if (o === void 0 || o === null) return 0;
          if (typeof o === "number") return 1;
          return 2;
        },
        LB: (x0) => x0.headers,
        LC: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Uint8Array) return 1;
          return 2;
        },
        LD: () => typeof dartUseDateNowForTicks !== "undefined",
        M: (x0) => x0.index,
        MB: () => ({}),
        MC: Function.prototype.call.bind(DataView.prototype.setInt8),
        MD: () => Date.now(),
        N: (o) => String(o),
        NB: (o, p, v) => o[p] = v,
        NC: Function.prototype.call.bind(DataView.prototype.getInt8),
        ND: () => 1e3 * performance.now(),
        O: (o) => o === void 0,
        OB: () => [],
        OC: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Int8Array) return 1;
          return 2;
        },
        OD: (x0, x1) => x0.getRandomValues(x1),
        P: (x0, x1) => x0.exec(x1),
        PB: (a, i) => a.push(i),
        PC: (o, start, length) => new Float64Array(o.buffer, o.byteOffset + start, length),
        PD: () => globalThis.crypto,
        Q: (x0, x1) => {
          x0.lastIndex = x1;
        },
        QB: (x0) => new Int8Array(x0),
        QC: (o, start, length) => new Float32Array(o.buffer, o.byteOffset + start, length),
        QD: (l) => new DataView(new ArrayBuffer(l)),
        R: (o) => o,
        RB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const getValue = dartInstance.exports.$wasmI8ArrayGet;
          for (let i = 0; i < length; i++) {
            jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
          }
        },
        RC: (o, start, length) => new Uint32Array(o.buffer, o.byteOffset + start, length),
        RD: () => new AbortController(),
        S: (s, m) => {
          try {
            return new RegExp(s, m);
          } catch (e) {
            return String(e);
          }
        },
        SB: (x0) => new Uint8Array(x0),
        SC: (o, start, length) => new Int32Array(o.buffer, o.byteOffset + start, length),
        SD: (x0, x1, x2, x3, x4, x5) => ({ method: x0, headers: x1, body: x2, credentials: x3, redirect: x4, signal: x5 }),
        T: (o) => o instanceof RegExp,
        TB: (x0) => new Uint8ClampedArray(x0),
        TC: (o, start, length) => new Uint16Array(o.buffer, o.byteOffset + start, length),
        TD: (x0, x1) => globalThis.fetch(x0, x1),
        U: (string, times) => string.repeat(times),
        UB: (x0) => new Int16Array(x0),
        UC: (o, start, length) => new Int16Array(o.buffer, o.byteOffset + start, length),
        UD: (wasmFunction, f) => finalizeWrapper(f, function(x0, x1, x2) {
          return wasmFunction(f, arguments.length, x0, x1, x2);
        }),
        V: (o) => o,
        VB: (x0) => new Uint16Array(x0),
        VC: (o, start, length) => new Uint8ClampedArray(o.buffer, o.byteOffset + start, length),
        VD: (x0, x1) => x0.forEach(x1),
        W: (o) => {
          if (o === void 0 || o === null) return 0;
          if (typeof o === "boolean") return 1;
          return 2;
        },
        WB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const getValue = dartInstance.exports.$wasmI16ArrayGet;
          for (let i = 0; i < length; i++) {
            jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
          }
        },
        WC: (o, start, length) => new Uint8Array(o.buffer, o.byteOffset + start, length),
        WD: (x0) => x0.name,
        X: (x0) => x0.dotAll,
        XB: (x0) => new Int32Array(x0),
        XC: (o, start, length) => new Int8Array(o.buffer, o.byteOffset + start, length),
        XD: (x0) => x0.statusText,
        Y: (x0) => x0.unicode,
        YB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const getValue = dartInstance.exports.$wasmI32ArrayGet;
          for (let i = 0; i < length; i++) {
            jsArray[jsArrayOffset + i] = getValue(wasmArray, wasmArrayOffset + i);
          }
        },
        YC: (o, p, r) => o.replace(p, () => r),
        YD: (x0) => x0.url,
        Z: (x0) => x0.ignoreCase,
        ZB: (x0) => new Uint32Array(x0),
        ZC: (o, p, r) => o.replaceAll(p, () => r),
        ZD: (x0) => x0.getReader(),
        a: (x0) => x0.multiline,
        aB: (x0) => new Float32Array(x0),
        aC: () => {
          return typeof process != "undefined" && Object.prototype.toString.call(process) == "[object process]" && process.platform == "win32";
        },
        aD: (x0) => x0.read(),
        b: (exn) => {
          if (exn instanceof Error) {
            return exn.stack;
          } else {
            return null;
          }
        },
        bB: (x0) => new Float64Array(x0),
        bC: () => {
          if (globalThis.location != null) {
            return globalThis.location.href;
          }
          return null;
        },
        bD: (x0) => x0.value,
        c: (wasmFunction, f) => finalizeWrapper(f, function(x0) {
          return wasmFunction(f, arguments.length, x0);
        }),
        cB: (x0) => new ArrayBuffer(x0),
        cC: (x0) => ({ create: x0 }),
        cD: (x0) => x0.cancel(),
        d: (x0, x1) => {
          x0.onmessage = x1;
        },
        dB: (x0, x1, x2) => new Uint8Array(x0, x1, x2),
        dC: (x0, x1, x2) => x0.getFileHandle(x1, x2),
        dD: (x0) => x0.done,
        e: (x0, x1, x2) => x0.postMessage(x1, x2),
        eB: (x0, x1, x2) => new DataView(x0, x1, x2),
        eC: (x0) => x0.createSyncAccessHandle(),
        eD: (x0) => x0.body,
        f: (x0, x1) => x0.fetch(x1),
        fB: (o, p) => o[p],
        fC: (x0, x1) => x0.truncate(x1),
        fD: (x0) => x0.signal,
        g: (x0) => x0.text(),
        gB: (x0) => new Array(x0),
        gC: (x0, x1) => x0.write(x1),
        gD: (x0, x1) => x0.removeEntry(x1),
        h: (c) => queueMicrotask(() => dartInstance.exports.$invokeCallback(c)),
        hB: (x0, x1, x2) => {
          x0[x1] = x2;
        },
        hC: (x0) => x0.flush(),
        hD: (o) => [o],
        i: (b) => !!b,
        iB: (o) => new DataView(o.buffer, o.byteOffset, o.byteLength),
        iC: (x0) => x0.close(),
        iD: (o0, o1) => [o0, o1],
        j: (x0) => ({ recursive: x0 }),
        jB: Function.prototype.call.bind(Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength").get),
        jC: (string, token) => string.split(token),
        jD: (o0, o1, o2) => [o0, o1, o2],
        k: (x0, x1, x2) => x0.removeEntry(x1, x2),
        kB: (o) => o.byteOffset,
        kC: (o) => o instanceof Array,
        kD: (o0, o1, o2, o3) => [o0, o1, o2, o3],
        l: (x0) => ({ create: x0 }),
        lB: Function.prototype.call.bind(DataView.prototype.setFloat64),
        lC: (a, i, v) => a[i] = v,
        lD: (o, p, v) => o[p] = v,
        m: (x0, x1, x2) => x0.getDirectoryHandle(x1, x2),
        mB: (o) => o.buffer,
        mC: (a, i) => a[i],
        mD: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof ArrayBuffer) return 1;
          if (globalThis.SharedArrayBuffer !== void 0 && o instanceof SharedArrayBuffer) {
            return 2;
          }
          return 3;
        },
        n: (x0, x1) => x0.test(x1),
        nB: (b, o) => new DataView(b, o),
        nC: (a) => a.length,
        nD: (x0) => x0.getDirectory(),
        o: (x0) => x0.kind,
        oB: (b, o, l) => new DataView(b, o, l),
        oC: (a, s) => a.join(s),
        oD: (o, p) => o[p],
        p: (x0) => x0.name,
        pB: (l, r) => l === r,
        pC: (x0, x1) => x0.postMessage(x1),
        pD: (o) => {
          const typeofValue = typeof o;
          return typeofValue === "object" || typeofValue === "function";
        },
        q: (o, m, a) => o[m].apply(o, a),
        qB: Function.prototype.call.bind(DataView.prototype.getFloat64),
        qC: (decoder, codeUnits) => decoder.decode(codeUnits),
        qD: (x0) => x0.data,
        r: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
          const setValue = dartInstance.exports.$wasmI8ArraySet;
          for (let i = 0; i < length; i++) {
            setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
          }
        },
        rB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Float64Array) return 1;
          return 2;
        },
        rC: () => new TextDecoder("utf-8", { fatal: true }),
        rD: () => globalThis,
        s: (x0) => x0.random(),
        sB: (t, s) => t.set(s),
        sC: () => new TextDecoder("utf-8", { fatal: false }),
        t: () => globalThis.Math,
        tB: Function.prototype.call.bind(DataView.prototype.setFloat32),
        tC: (x0) => x0.status,
        u: (ms, c) => setTimeout(() => dartInstance.exports.$invokeCallback(c), ms),
        uB: Function.prototype.call.bind(DataView.prototype.getFloat32),
        uC: (wasmFunction, f) => finalizeWrapper(f, function(x0) {
          return wasmFunction(f, arguments.length, x0);
        }),
        v: (s) => +s,
        vB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Float32Array) return 1;
          return 2;
        },
        vC: (wasmFunction, f) => finalizeWrapper(f, function(x0, x1) {
          return wasmFunction(f, arguments.length, x0, x1);
        }),
        w: (s) => {
          if (!/^\s*[+-]?(?:Infinity|NaN|(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?)\s*$/.test(s)) {
            return NaN;
          }
          return parseFloat(s);
        },
        wB: Function.prototype.call.bind(DataView.prototype.setUint32),
        wC: (p, s, f) => p.then(s, (e) => f(e, e === void 0)),
        x: (s) => s.trim(),
        xB: Function.prototype.call.bind(DataView.prototype.getUint32),
        xC: (o) => typeof o === "function" && o[jsWrappedDartFunctionSymbol] === true,
        y: (s) => s.toUpperCase(),
        yB: (o) => {
          if (o === null || o === void 0) return 0;
          if (o instanceof Uint32Array) return 1;
          return 2;
        },
        yC: (f) => f.dartFunction,
        z: Object.is,
        zB: Function.prototype.call.bind(DataView.prototype.setInt32),
        zC: (o, i) => o[i]
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
  function resolveRelativeFetch(base) {
    const toolchain = new URL("toolchain/", base).toString();
    const original = self.fetch.bind(self);
    self.fetch = (input, init) => {
      if (typeof input === "string" && !/^[a-z]+:/i.test(input)) {
        return original(new URL(input, toolchain).toString(), init);
      }
      return original(input, init);
    };
  }
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

  // public/workspace_worker_src.mjs
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
      resolveRelativeFetch(base);
      const wasmUrl = new URL("toolchain/workspace.wasm", base).toString();
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
//# sourceMappingURL=workspace_worker.js.map
