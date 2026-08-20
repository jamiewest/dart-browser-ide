// Boot for the workspace worker — projects, files and pub, over OPFS.
// Classic bundle for the same reason as the other two (see lsp_worker_src.mjs).
//
// The pub side needs no proxy: pub.dev answers with `access-control-allow-origin: *`
// on both its API and its archives, and a CORS-passing fetch also satisfies
// COEP, so it works from the cross-origin-isolated tab unchanged.
import * as loader from '../../web/workspace.mjs';
import { awaitBase, resolveRelativeFetch } from './worker_base.mjs';

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
    // seed_flutter fetches `assets/flutter_bundle.json` relative to itself.
    resolveRelativeFetch(base);
    const wasmUrl = new URL('toolchain/workspace.wasm', base).toString();
    const app = await loader.compileStreaming(fetch(wasmUrl));
    const instance = await app.instantiate({});
    instance.invokeMain();
    self.removeEventListener('message', buffer);
    self.postMessage({ type: 'booted', replayed: pending.length });
    for (const event of pending) self.onmessage(event);
  } catch (error) {
    self.postMessage({ type: 'boot_error', message: describe(error) });
  }
})();
