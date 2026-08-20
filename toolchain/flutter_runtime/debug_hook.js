// Userland debugger, Flutter side: the host half of the instrumentation
// contract inside the preview.
//
// A debug-instrumented build calls __dbgCheck before every statement of the
// user's own libraries and __dbgPause on a hit. In a console run both live in
// the execution worker, where a pause is `Atomics.wait` on a SharedArrayBuffer
// shared with the page. Neither half of that works here: the Dart app runs on
// this document's MAIN thread (Atomics.wait is banned there), and the preview
// is a different WebView — actually a different process — from the IDE, so no
// SharedArrayBuffer can reach it.
//
// So the transport is HTTP against whichever host served this page (the shell's
// LoopbackServer on device, web/serve.py in the browser pane):
//
//   POST /__debug/pause    <- the pause itself. SYNCHRONOUS XHR: the request is
//                             held open by the server until the IDE issues a
//                             command, and a synchronous XHR blocks this thread
//                             while it waits. That block IS the paused program.
//                             The reply carries the command and the current
//                             breakpoint list.
//
// __dbgCheck must stay purely local — it runs before every statement — so the
// breakpoint set lives in this file and is refreshed two ways: pushed in by the
// IDE (window.__dbgSetBreakpoints, via runJavaScript or from the pane's parent
// frame) while the program runs, and carried on the pause reply while it is
// blocked and no script can be injected.
//
// Both hooks are defined unconditionally. They have to be: an instrumented app
// whose host lacks them throws on its first statement, and the same
// index.html serves debug and plain builds.
(() => {
  const ENDPOINT = '/__debug/pause';

  // Seeded from the launch URL, not pushed in after load: the program's first
  // statement can run before any injected script does, and a breakpoint in
  // main() is exactly the one that would be lost to that race.
  let breakpoints = new Set((() => {
    try {
      const raw = new URLSearchParams(location.search).get('bp');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  })());
  let mode = 0;    // step mode in effect: 0 none, 1 into, 2 over, 3 out
  let target = 0;  // depth the step was issued from (modes 2 and 3)
  let pauseRequested = false;
  // Set when the IDE stops the session or the transport dies. The program
  // keeps running — an app that can never be resumed must not be frozen —
  // but nothing pauses again.
  let disarmed = false;

  /// Replaces the breakpoint list. Called by the IDE while the program runs.
  window.__dbgSetBreakpoints = (list) => {
    breakpoints = new Set(list ?? []);
    return true;
  };

  /// Breaks in at the next statement, wherever the program is. Unlike the
  /// console debugger's PAUSE flag this is read on this same thread, so it can
  /// only be delivered while the program is running — which is exactly when it
  /// is meaningful.
  window.__dbgRequestPause = () => {
    if (disarmed) return false;
    pauseRequested = true;
    return true;
  };

  /// True once a pause is impossible: the session was stopped, or the IDE went
  /// away mid-pause. The shell reads this to decide whether the preview still
  /// has a live debug session.
  window.__dbgDisarmed = () => disarmed;

  window.__dbgCheck = (file, line, depth) => {
    if (disarmed) return 0;
    if (pauseRequested) return 1;
    if (breakpoints.has(file + ':' + line)) return 1;
    switch (mode) {
      case 1: return 1;                       // into: the next statement
      case 2: return depth <= target ? 1 : 0; // over: this frame or its caller
      case 3: return depth < target ? 1 : 0;  // out: the caller's frame
      default: return 0;
    }
  };

  window.__dbgPause = (file, line, localsJson, depth) => {
    pauseRequested = false;
    let locals = {};
    try {
      locals = JSON.parse(localsJson);
    } catch (_) {
      // A local whose toString produced invalid JSON must not cost the pause.
    }
    const request = new XMLHttpRequest();
    let body = '';
    try {
      request.open('POST', ENDPOINT, false);
      request.setRequestHeader('Content-Type', 'application/json');
      request.send(JSON.stringify({ file, line, depth, locals }));
      body = request.responseText;
    } catch (_) {
      // No IDE listening (a plain reload of a debug build, or the shell went
      // away). Run on, and never block again.
      disarmed = true;
      mode = 0;
      return 1;
    }
    let reply = {};
    try {
      reply = JSON.parse(body) ?? {};
    } catch (_) {
      // Same reasoning: an unreadable reply is a dead transport.
      disarmed = true;
      mode = 0;
      return 1;
    }
    if (Array.isArray(reply.breakpoints)) {
      breakpoints = new Set(reply.breakpoints);
    }
    if (reply.cmd === 'stop') {
      // The IDE is tearing the preview down. It cannot navigate away while
      // this thread is blocked, so the only useful thing to do is return and
      // stay out of the way.
      disarmed = true;
      breakpoints = new Set();
      mode = 0;
      return 1;
    }
    mode = reply.cmd === 'step' ? (reply.mode | 0) : 0;
    target = reply.target | 0;
    return 1;
  };
})();
