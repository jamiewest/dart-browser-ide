// How a worker learns where the app is served from.
//
// Not `self.name`, and not `import.meta.url`. The extension host re-hosts every
// worker through a generated blob shim (see lsp_worker_src.mjs), and that shim
// keeps neither: `self.location` is the blob, and the `name` option does not
// survive. Relative URLs therefore resolve against the origin, which is right
// only when the app is served from the domain root — so this was invisible
// until the site was tested from a GitHub Pages-style subpath.
//
// Instead the client sends `{type: 'boot', base}` as its first message, and the
// worker waits for it before fetching anything. Callers must buffer messages
// from line one (top-level await enables the port queue), which every boot
// script here already does.
/// Makes relative `fetch` calls inside the worker resolve against the app's
/// toolchain directory instead of the blob the shim runs from.
///
/// The Dart workers fetch their own assets by relative path — `seed_flutter`
/// asks for `assets/flutter_bundle.json` — which worked when the worker was a
/// real script next to them. Under the extension host's blob shim there is no
/// such neighbourhood, so the base has to be reapplied here rather than edited
/// into the SDK sources the Flutter shell also uses.
export function resolveRelativeFetch(base) {
  const toolchain = new URL('toolchain/', base).toString();
  const original = self.fetch.bind(self);
  self.fetch = (input, init) => {
    if (typeof input === 'string' && !/^[a-z]+:/i.test(input)) {
      return original(new URL(input, toolchain).toString(), init);
    }
    return original(input, init);
  };
}

export function awaitBase(pending) {
  const buffered = pending.findIndex(
    (event) => event.data && event.data.type === 'boot');
  if (buffered >= 0) {
    const [event] = pending.splice(buffered, 1);
    return Promise.resolve(event.data.base);
  }
  return new Promise((resolve) => {
    const listener = (event) => {
      if (!event.data || event.data.type !== 'boot') return;
      self.removeEventListener('message', listener);
      resolve(event.data.base);
    };
    self.addEventListener('message', listener);
  });
}
