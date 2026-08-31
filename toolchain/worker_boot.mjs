// Generic boot script for dart2wasm-compiled module workers.
// Usage: new Worker('worker_boot.mjs', {type: 'module', name: 'compiler'})
// The worker's `name` selects which <name>.mjs/<name>.wasm pair to boot.
//
// TRAP WEB-1 (docs/blockers.md): with top-level await, the port message queue
// enables at the first await — before Dart main() installs onmessage. Buffer
// synchronously from line one and replay after main() has run.
//
// TRAP WEB-3 (docs/blockers.md): identity must NOT ride in a query string.
// Module scripts take import.meta.url from the RESPONSE URL; a service-worker
// cache hit stored under the bare URL drops the query, silently breaking
// `searchParams.get(...)`. `self.name` is immune.
const pendingMessages = [];
const bufferListener = (event) => pendingMessages.push(event);
self.addEventListener('message', bufferListener);

// A Dart exception that escapes the instance arrives here as a
// WebAssembly.Exception, whose default stringification is the useless
// "[object WebAssembly.Exception]". Report every field that might carry the
// real cause instead of concatenating the event.
function describe(value) {
  if (value == null) return '';
  const parts = [];
  const message = value.message ?? (typeof value === 'string' ? value : '');
  if (message) parts.push(String(message));
  if (value.stack) parts.push(String(value.stack));
  if (!parts.length) {
    // WebAssembly.Exception carries its payload in tagged values that JS
    // cannot read without the tag; the constructor name is all we get.
    const name = value.constructor?.name ?? typeof value;
    parts.push(name === 'Object' ? String(value) : `<${name}>`);
  }
  return parts.join(' — ');
}

self.addEventListener('unhandledrejection', (e) => {
  self.postMessage({
    type: 'boot_error',
    worker: self.name,
    message: `unhandled rejection: ${describe(e.reason) || String(e.reason)}`,
  });
});
self.addEventListener('error', (e) => {
  const detail = describe(e.error) || describe(e.message);
  const where = e.filename ? ` (${e.filename}:${e.lineno ?? 0})` : '';
  self.postMessage({
    type: 'boot_error',
    worker: self.name,
    message: `error: ${detail || 'no detail available'}${where}`,
  });
});

const moduleName = self.name;

try {
  const loader = await import(`./${moduleName}.mjs`);
  const app = await loader.compileStreaming(fetch(`./${moduleName}.wasm`));
  const instance = await app.instantiate({});
  instance.invokeMain(); // Dart main() installs self.onmessage synchronously.
  self.removeEventListener('message', bufferListener);
  self.postMessage({ type: 'boot_progress', step: `${moduleName} started, replaying ${pendingMessages.length} buffered message(s)` });
  for (const event of pendingMessages) self.onmessage(event);
} catch (error) {
  self.postMessage({
    type: 'boot_error',
    worker: moduleName,
    message: describe(error) || String(error),
    stack: error && error.stack ? String(error.stack) : null,
  });
}
