# Dart IDE in a browser tab

The built site for [browser-ide](https://github.com/jamiewest/dart_sdk_wasm):
[code-oss](https://github.com/microsoft/vscode) running entirely in a browser
tab, with the Dart analyzer, CFE, dart2wasm and pub compiled to WebAssembly.
No server, no container, no network round-trip for anything but `pub get`.

**Live: https://jamiewest.github.io/dart-browser-ide/**

- Analysis is `analysis_server`'s own LSP server, compiled to Wasm.
- `pub get` resolves against pub.dev and unpacks into an OPFS pub-cache.
- Run and debug go through a debug adapter, so program output lands in the
  Debug Console and breakpoints work in the gutter.

This repository holds **only build output** and is force-pushed on each deploy.
Sources live in the repository linked above.

Third-party code included here: code-oss (MIT, Microsoft), the GitHub themes
(MIT, Primer), JetBrains Mono and Inter (OFL-1.1). Their licences ship beside
the files they belong to.
