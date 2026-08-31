// Source for the Dart language-server worker. Bundled by build.mjs into
// `public/lsp_worker.js` as a **classic** (IIFE) script, which is not a
// stylistic choice:
//
// The web extension host patches the global `Worker` constructor. Every worker
// an extension creates is re-hosted through a generated blob shim that calls
// `importScripts(yourUrl)` — and `importScripts` is illegal in a module worker,
// so `{type:'module'}` fails with "Module scripts don't support
// importScripts()". A classic script loaded by that shim works, so the ES
// module dart2wasm emits has to be bundled in rather than imported at runtime.
//
// For the same reason nothing here may rely on `import.meta.url`: the shim runs
// this code from a blob, so relative URLs resolve against the blob, not the
// app. The app's base URL arrives as the worker's `name` (trap WEB-3 in
// docs/blockers.md — identity belongs in `self.name`, never in a query string).
import * as loader from './lsp.mjs';

import { awaitBase } from './worker_base.mjs';

const pending = [];
const buffer = (event) => pending.push(event);
self.addEventListener('message', buffer);

function describe(value) {
  if (value == null) return '';
  const parts = [];
  const message = value.message ?? (typeof value === 'string' ? value : '');
  if (message) parts.push(String(message));
  if (value.stack) parts.push(String(value.stack));
  if (!parts.length) {
    const name = value.constructor?.name ?? typeof value;
    parts.push(name === 'Object' ? String(value) : `<${name}>`);
  }
  return parts.join(' — ');
}

self.addEventListener('unhandledrejection', (event) => {
  self.postMessage({ type: 'boot_error', message: describe(event.reason) });
});

(async () => {
  try {
    const base = await awaitBase(pending);
    const wasmUrl = new URL('public/lsp.wasm', base).toString();
    const app = await loader.compileStreaming(fetch(wasmUrl));
    const instance = await app.instantiate({});
    instance.invokeMain(); // installs self.onmessage synchronously
    self.removeEventListener('message', buffer);
    self.postMessage({ type: 'booted', replayed: pending.length });
    for (const event of pending) self.onmessage(event);
  } catch (error) {
    self.postMessage({ type: 'boot_error', message: describe(error) });
  }
})();
