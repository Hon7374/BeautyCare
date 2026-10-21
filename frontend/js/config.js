// ===============================
// Frontend runtime config
// ===============================
// Default: call API on the same origin when frontend is served by backend.
// If the page is opened from a local dev server such as :5500, automatically target backend :3000.
// You can still override manually via:
//   localStorage.setItem('API_BASE','http://localhost:3000/api')
function resolveApiBase() {
  const override = localStorage.getItem('API_BASE');
  if (override) return override;

  const { protocol, hostname, port, origin } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalHost && port && port !== '3000') {
    return `${protocol}//${hostname}:3000/api`;
  }

  return `${origin}/api`;
}

const API = resolveApiBase().replace(/\/+$/,'');
window.API = API;

// Compute the *frontend base URL* automatically.
// Works for both:
//  - http://localhost:3000/                 (backend serves frontend)
//  - http://127.0.0.1:5500/                 (Live Server root = frontend)
//  - http://127.0.0.1:5500/frontend         (Live Server root = project)
//  - http://127.0.0.1:5500/<project>/frontend (nested)
(function attachFrontBase() {
  const p = String(window.location.pathname || '');
  const marker = '/frontend/';
  const idx = p.indexOf(marker);
  let base = '';
  if (idx >= 0) base = p.slice(0, idx) + '/frontend';
  if (!base && p.endsWith('/frontend')) base = p;
  window.FRONTEND_BASE = base;
  window.FRONTEND_URL = `${window.location.origin}${base}`;
})();
