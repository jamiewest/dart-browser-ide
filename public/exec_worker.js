// Boot script for a disposable execution worker (gate G4).
// Receives {type:'run', wasm: ArrayBuffer, loader: string, debug?} once,
// executes the compiled program, streams stdout lines and errors back, then
// the page terminates the worker. A fresh worker is spawned per run.
// `debug` (optional) is the userland-debugger channel: {ctrl, data}
// SharedArrayBuffers created by the page (passed by reference).
self.onmessage = async (event) => {
  const { type, wasm, loader, debug } = event.data;
  if (type !== 'run') return;

  // dart2wasm's generated print pathway prefers a global `dartPrint`.
  globalThis.dartPrint = (line) => {
    self.postMessage({ type: 'stdout', line: String(line) });
  };

  // Userland debugger hooks. Instrumented debug builds call these from wasm
  // via dart:js_interop before every statement (__dbgCheck) and on a hit
  // (__dbgPause); non-debug binaries never call them. Both carry the call
  // depth of instrumented frames, which is what separates a step over from a
  // step into. Channel layout:
  //   ctrl = SharedArrayBuffer(32) viewed as Int32Array:
  //     [0] CMD     0 none, 1 continue, 2 step — this thread Atomics.waits
  //     [1] EPOCH   bumped by the page whenever the breakpoint list changes
  //     [2] DATALEN byte length of the JSON currently in `data`
  //     [3] PAUSE   1 = pause at the next statement (asynchronous pause)
  //     [4] MODE    step mode of the last command: 0 none, 1 into, 2 over,
  //                 3 out
  //     [5] TARGET  depth the step was issued from (modes 2 and 3)
  //   data = SharedArrayBuffer(65536): UTF-8 JSON array of "file:line"
  //     breakpoint strings, e.g. ["lib/main.dart:3"].
  if (debug && debug.ctrl && debug.data) {
    const ctrl = new Int32Array(debug.ctrl);
    const dataBytes = new Uint8Array(debug.data);
    let bps = new Set();
    let epoch = 0;
    let mode = 0;    // step mode currently in effect
    let target = 0;  // depth the step was issued from
    const loadBps = () => {
      const len = Atomics.load(ctrl, 2);
      // slice() copies out of the SAB — TextDecoder rejects shared views.
      bps = new Set(JSON.parse(new TextDecoder().decode(dataBytes.slice(0, len))));
      epoch = Atomics.load(ctrl, 1);
    };
    loadBps();
    globalThis.__dbgCheck = (file, line, depth) => {
      if (Atomics.load(ctrl, 1) !== epoch) loadBps();
      if (Atomics.load(ctrl, 3)) return 1;        // pause requested
      if (bps.has(file + ':' + line)) return 1;
      switch (mode) {
        case 1: return 1;                          // into: the next statement
        case 2: return depth <= target ? 1 : 0;    // over: same frame or out
        case 3: return depth < target ? 1 : 0;     // out: the caller's frame
        default: return 0;
      }
    };
    globalThis.__dbgPause = (file, line, localsJson, depth) => {
      self.postMessage({
        type: 'dbg_paused', file, line, depth, locals: JSON.parse(localsJson),
      });
      Atomics.store(ctrl, 3, 0); // the requested pause happened
      Atomics.store(ctrl, 0, 0);
      Atomics.wait(ctrl, 0, 0); // block until the page posts a command
      const cmd = Atomics.exchange(ctrl, 0, 0);
      mode = cmd === 2 ? Atomics.load(ctrl, 4) : 0;
      target = Atomics.load(ctrl, 5);
      if (Atomics.load(ctrl, 1) !== epoch) loadBps();
      self.postMessage({ type: 'dbg_resumed' });
      return 1;
    };
  } else {
    // No channel: debug and non-debug binaries both run, never pausing.
    globalThis.__dbgCheck = () => 0;
    globalThis.__dbgPause = () => 1;
  }

  try {
    const blobUrl = URL.createObjectURL(
      new Blob([loader], { type: 'text/javascript' })
    );
    const module = await import(blobUrl);
    URL.revokeObjectURL(blobUrl);

    const app = await module.compile(new Uint8Array(wasm));
    const instance = await app.instantiate({});
    instance.invokeMain();
    self.postMessage({ type: 'done' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: String(error),
      stack: error && error.stack ? String(error.stack) : null,
    });
  }
};
