// Forwards this frame's errors/load state to both hosts: postMessage for the
// browser harness iframe, and PreviewBridge for the native shell WebView.
window.__reportFlutterPreview = (message) => {
  if (parent !== window) parent.postMessage(message, '*');
  if (window.PreviewBridge) {
    const type = message.type === 'flutter_frame_error'
      ? 'error'
      : message.type === 'flutter_app_started' ? 'started' : message.type;
    window.PreviewBridge.postMessage(JSON.stringify({ ...message, type }));
  }
};

window.addEventListener('error', (e) => window.__reportFlutterPreview(
  { type: 'flutter_frame_error', message: String(e.message || e.error) }));
window.addEventListener('unhandledrejection', (e) => window.__reportFlutterPreview(
  { type: 'flutter_frame_error',
    message: 'unhandled: ' + String(e.reason && (e.reason.message || e.reason)) +
      ' | ' + String(e.reason && e.reason.stack).slice(0, 300) }));
window.addEventListener('load', () => window.__reportFlutterPreview(
  { type: 'flutter_frame_loaded', coi: window.crossOriginIsolated === true,
    sab: typeof SharedArrayBuffer !== 'undefined' }));
