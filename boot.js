// Constructs the workbench. Everything a server would normally template into
// product.json is decided here, because there is no server: this page is meant
// to work unchanged from a `file`-less static host (GitHub Pages).
//
// Two omissions are deliberate and load-bearing:
//
//   * no `webEndpointUrlTemplate` / `commit` / `quality` in the product
//     configuration. When all three are present, code-oss hosts the web worker
//     extension host in an iframe on a *different* origin (that is what
//     vscode-cdn.net is for). A different origin means a different OPFS bucket
//     — the extension host would not see the files the page's toolchain workers
//     wrote. Omitting them falls back to a same-origin iframe, which is what
//     makes one shared workspace possible. The cost is that extensions are no
//     longer isolated from page storage; we ship every extension here, so that
//     is a trade we can make and a stranger's marketplace extension is not.
//
//   * no `extensionsGallery`. There is no marketplace: extensions are the ones
//     served from /extensions.
/// Resolves once the window has a size.
///
/// `create()` measures the window and throws "Unable to figure out browser
/// width and height" if it is 0x0, which aborts startup and leaves a blank
/// page — and a tab opened in the background is exactly 0x0 until it is first
/// painted. Waiting is cheap and removes a failure that looks like a crash.
function windowHasSize() {
  if (window.innerWidth && window.innerHeight) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (window.innerWidth && window.innerHeight) {
        window.removeEventListener('resize', check);
        document.removeEventListener('visibilitychange', check);
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    window.addEventListener('resize', check);
    document.addEventListener('visibilitychange', check);
    requestAnimationFrame(check);
  });
}

require(['vs/workbench/workbench.web.main'], async (workbench) => {
  const { URI } = require('vs/base/common/uri');
  await windowHasSize();

  // Relative to the document base so the app works from a GitHub Pages
  // subpath as well as from a domain root.
  const appBase = new URL('.', document.baseURI).toString();
  const extensionUri = (name) =>
    URI.parse(new URL(`extensions/${name}`, appBase).toString());

  const workspaceUri = URI.from({ scheme: 'opfs', authority: '', path: '/workspace' });

  workbench.create(document.body, {
    productConfiguration: {
      nameShort: 'Dart IDE',
      nameLong: 'Dart IDE (browser)',
      applicationName: 'dart-ide',
      dataFolderName: '.dart-ide',
      version: '1.91.1',
      // No extensionsGallery, no webEndpointUrlTemplate — see above.
      licenseUrl: 'https://github.com/microsoft/vscode/blob/main/LICENSE.txt',
      reportIssueUrl: undefined,
      // The Flutter preview opens on this app's own origin, and without this
      // every run stops on "Do you want Dart IDE to open the external
      // website?". Only our own origin is trusted; anything else still asks.
      linkProtectionTrustedDomains: [new URL(appBase).origin],
    },
    // No `webviewEndpoint`. Webviews are unusable here either way: the
    // implementation validates that its frame is served from a per-webview
    // subdomain and rejects a plain origin ("Expected '<uuid>' as hostname or
    // subdomain!"), while the default CDN endpoint needs the network this app
    // is built not to need. Nothing we ship uses one — the Flutter preview
    // opens in its own tab (extensions/dart-wasm/src/flutter.js).
    additionalBuiltinExtensions: [
      extensionUri('dart-wasm'),
      extensionUri('github-theme'),
    ],
    workspaceProvider: {
      workspace: { folderUri: workspaceUri },
      trusted: true,
      open: async () => false,
    },
    configurationDefaults: {
      // The 2024 workbench refresh is not a single flag in 1.91 — it is the
      // command centre plus the custom title bar. The activity bar stays on
      // the left, where VS Code puts it by default: `top` is part of that
      // refresh but it moves the one piece of chrome people navigate by
      // muscle memory.
      'workbench.colorTheme': 'GitHub Light Default',
      'workbench.preferredLightColorTheme': 'GitHub Light Default',
      'workbench.preferredDarkColorTheme': 'GitHub Dark Default',
      'workbench.iconTheme': 'vs-seti',
      'window.commandCenter': true,
      'window.titleBarStyle': 'custom',
      'workbench.activityBar.location': 'default',
      'workbench.layoutControl.enabled': true,
      'workbench.tree.indent': 12,
      'workbench.startupEditor': 'none',

      // Fonts are served from fonts/ — see the @font-face rules in index.html.
      // Cascadia Code in the editor, ligatures on. Cascadia Mono — the same
      // design without them — everywhere a ligature would misrepresent the
      // text: the Debug Console and the terminal print program output, where
      // `!=` is two bytes and should look like two, and Output is a log.
      // Hovers, suggestion details, parameter hints and the debug panes have
      // no setting of their own — they read `--monaco-monospace-font`, which
      // index.html redefines. So does the Output view, which has no setting
      // either and needs the inline style Monaco writes overridden.
      'editor.fontFamily': "'Cascadia Code Variable', ui-monospace, Menlo, monospace",
      'editor.fontLigatures': true,
      'editor.fontSize': 13,
      'editor.lineHeight': 1.6,
      'editor.inlayHints.fontFamily': "'Cascadia Mono Variable', ui-monospace, monospace",
      'editor.codeLensFontFamily': "'Cascadia Mono Variable', ui-monospace, monospace",
      'terminal.integrated.fontFamily': "'Cascadia Mono Variable', ui-monospace, monospace",
      'terminal.integrated.fontSize': 12,
      'debug.console.fontFamily': "'Cascadia Mono Variable', ui-monospace, monospace",
      'scm.inputFontFamily': "'Inter Variable', system-ui, sans-serif",

      // Editing defaults a Dart developer expects from the desktop extension.
      'editor.minimap.enabled': false,
      'editor.stickyScroll.enabled': true,
      'editor.bracketPairColorization.enabled': true,
      'editor.guides.bracketPairs': 'active',
      // `editor.inlayHints.enabled` and `editor.tabSize` are deliberately not
      // set here: the dart-wasm extension contributes them scoped to `[dart]`
      // exactly as Dart-Code does, and a global default would outrank nothing
      // but would hide where the value really comes from.
      'editor.formatOnSave': true,
      'editor.rulers': [80],
      'editor.renderWhitespace': 'selection',
      'editor.suggestSelection': 'first',
      'files.autoSave': 'afterDelay',
      'files.autoSaveDelay': 500,
      'files.trimTrailingWhitespace': true,
      'files.insertFinalNewline': true,
      'breadcrumbs.enabled': true,
      'outline.showVariables': true,
      'problems.showCurrentInStatus': true,

      // Nothing here phones home, and there is no marketplace.
      'telemetry.telemetryLevel': 'off',
      'update.mode': 'none',
      'extensions.autoCheckUpdates': false,
      'workbench.enableExperiments': false,
    },
    developmentOptions: { logLevel: 2 /* Info */ },
  });
});
