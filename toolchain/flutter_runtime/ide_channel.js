// The preview's channel back to whichever IDE launched it.
//
// The Flutter shell talks to its preview through the WebView's own bridges
// (PreviewBridge, runJavaScript) and needs none of this. The browser IDE has no
// such handle: `vscode.env.openExternal` opens a tab and returns nothing, and
// the extension host is a worker inside an iframe, several frames away from the
// preview's window. What the two do share is an origin — so a BroadcastChannel
// reaches from the extension host straight into this document.
//
// It carries exactly what the IDE cannot do without a handle:
//
//   ping    -> pong   Is the preview still open? The IDE ends the debug session
//                     when the tab goes away, and reopens it on a hot restart
//                     rather than reloading a tab that no longer exists.
//   reload            Hot restart. The new build is already in Cache Storage
//                     under the same paths, so a reload is the whole of it: a
//                     fresh document, a fresh module graph, the new app.
//   flutter_flag      Debug paint, repaint rainbow, slow animations and the
//                     rest of the debug toolbar. Upstream these are VM service
//                     extensions; here the app is compiled through a wrapper
//                     that exposes one function on globalThis, and this is the
//                     wire that reaches it (extensions/dart-wasm/src/
//                     flutter_debug.js).
//
// A message is addressed by `app`, the preview's own origin-relative path, so
// two IDEs on one origin (the dev server and a deployed copy under a subpath)
// do not restart each other's previews.
(() => {
  if (typeof BroadcastChannel !== 'function') return;
  const app = new URL('.', location.href).pathname;
  const channel = new BroadcastChannel('dart-wasm-preview');
  const mine = (message) => !message.app || message.app === app;

  channel.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || typeof message !== 'object' || !mine(message)) return;
    switch (message.type) {
      case 'ping':
        channel.postMessage({ type: 'pong', id: message.id, app });
        break;
      case 'flutter_flag': {
        // Absent until the app's own main has run, and absent entirely from a
        // build made before this wrapper existed. Neither is worth an error:
        // the IDE re-applies its flags after every restart.
        const hook = globalThis.__dartWasmFlutterDebug;
        if (typeof hook === 'function') hook(message.name, !!message.value);
        break;
      }
      case 'reload':
        // Not `location.reload()`: the loader resolves the app's modules
        // against `document.baseURI`, so a bumped build number on the document
        // does not change what is fetched — but it does keep the back/forward
        // cache and any in-flight prerender from answering with the old
        // document, and it makes the generation visible in the address bar.
        location.replace(
          message.url ?? location.href.replace(/([?&]build=)\d+/, `$1${message.build ?? 1}`),
        );
        break;
    }
  });

  // Unprompted, because the IDE's launch and this document's load race: the
  // tab may finish loading before the extension host starts pinging.
  channel.postMessage({ type: 'pong', id: 0, app });
})();
