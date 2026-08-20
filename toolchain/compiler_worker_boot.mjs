// Boot script for the compiler worker (a module worker).
//
// TRAP (recorded in docs/blockers.md): in a module worker with top-level
// await, the port message queue is enabled at the first `await` — long before
// the Dart main() installs its onmessage handler. Messages posted by the page
// during the multi-second wasm compile would be dispatched with no listener
// and silently lost. So: buffer synchronously from the first line, replay
// into the Dart-installed handler once main() has run.
const pendingMessages = [];
const bufferListener = (event) => pendingMessages.push(event);
self.addEventListener('message', bufferListener);

self.addEventListener('unhandledrejection', (e) => {
  self.postMessage({ type: 'boot_error', message: 'unhandled rejection: ' + e.reason });
});
self.addEventListener('error', (e) => {
  self.postMessage({ type: 'boot_error', message: 'error: ' + e.message });
});

try {
  const loader = await import('./compiler.mjs');
  const app = await loader.compileStreaming(fetch('./compiler.wasm'));
  const instance = await app.instantiate({});
  instance.invokeMain(); // Dart main() installs self.onmessage synchronously.
  self.removeEventListener('message', bufferListener);
  self.postMessage({ type: 'boot_progress', step: 'main started, replaying ' + pendingMessages.length + ' buffered message(s)' });
  for (const event of pendingMessages) self.onmessage(event);
} catch (error) {
  self.postMessage({
    type: 'boot_error',
    message: String(error),
    stack: error && error.stack ? String(error.stack) : null,
  });
}
