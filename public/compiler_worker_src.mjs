// Boot for the dart2wasm compiler worker. Same shape as lsp_worker_src.mjs and
// for the same reason: the extension host re-hosts every worker through an
// importScripts shim, so this must bundle to a classic script and may not rely
// on `import.meta.url`. The app base arrives as the worker's `name`.
//
// The protocol is the Dart side's, unchanged (pkg/browser_compiler/lib/
// compiler_worker.dart): init{platformDill} -> ready, writeFile/deleteFile,
// compile{entryPoint, debug} -> compile_result{success, wasm, loader,
// diagnostics, stats}.
import * as loader from '../../web/compiler.mjs';
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
    const wasmUrl = new URL('toolchain/compiler.wasm', base).toString();
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
