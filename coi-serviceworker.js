// Cross-origin isolation on a host that cannot set headers.
//
// GitHub Pages serves static files and nothing else — no COOP/COEP. Without
// those two headers `SharedArrayBuffer` is unavailable, and with it goes the
// execution worker's debugger (Atomics.wait) and Flutter's shared-memory Wasm.
//
// A service worker can add the headers to its own responses, which is enough:
// the document that installs it reloads once, and from then on every response
// this worker serves carries them. The pattern is well known (`coi-serviceworker`);
// this is a minimal version with no third-party code.
//
// Note the symmetry with the Flutter shell: the service worker WKWebView will
// not give us is exactly the mechanism that makes the browser build deployable.
const COOP = 'same-origin';
const COEP = 'require-corp';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'deregister') {
    self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    });
  }
});

// Where a compiled Flutter app is published. The preview page asks for
// `main.dart.wasm` and `main.dart.mjs` beside the static engine; those two are
// answered from here, everything else from the network. This is the browser's
// version of the HTTP PUT the Flutter shell uses, which exists only because
// WKWebView has no service worker to do this.
const APP_CACHE = 'flutter-app';

async function fromAppCache(request) {
  if (!/\/main\.dart\.(wasm|mjs)$/.test(new URL(request.url).pathname)) {
    return null;
  }
  const cache = await caches.open(APP_CACHE);
  return (await cache.match(request, { ignoreSearch: true })) ?? null;
}

function isolate(response) {
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', COEP);
  headers.set('Cross-Origin-Opener-Policy', COOP);
  if (!headers.has('Cross-Origin-Resource-Policy')) {
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  event.respondWith(
    fromAppCache(request).then((hit) => hit && isolate(hit)).then((hit) => hit ||
    fetch(request)
      .then((response) => response.status === 0 ? response : isolate(response))
      .catch((error) => new Response(String(error), { status: 502 }))),
  );
});
