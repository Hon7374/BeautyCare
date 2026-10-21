function getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[2]) : null;
}

async function ensureCsrfToken() {
  // csrf_token cookie is set by backend; call /auth/csrf if missing.
  const existing = getCookie('csrf_token');
  if (existing) return existing;
  try {
    const url = `${API}/auth/csrf`;
    const res = await fetch(url, { credentials: 'include' });
    const data = await res.json().catch(() => null);
    return (data && data.csrfToken) ? data.csrfToken : getCookie('csrf_token');
  } catch (e) {
    return getCookie('csrf_token');
  }
}

async function apiFetch(path, options = {}, _retry = false) {
  const url = path.startsWith('http') ? path : (`${API}${path.startsWith('/') ? '' : '/'}${path}`);
  const method = (options.method || 'GET').toUpperCase();

  const headers = { ...(options.headers || {}) };

  // Attach Bearer token if present (some builds store token in localStorage).
  // Cookie auth still works; this is a safe fallback for cases where cookies are missing/cleared.
  try {
    const lsToken = localStorage.getItem('token');
    if (lsToken && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${lsToken}`;
    }
  } catch (_) {
    // ignore
  }
  // Always set JSON content-type if body is provided and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // CSRF for state-changing requests when using cookies
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  // Auto-refresh access token once if expired
  if (res.status === 401 && !_retry && getCookie('refresh_token')) {
    try {
      const csrf = await ensureCsrfToken();
      const rr = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf || '' }
      });
      if (rr.ok) {
        return apiFetch(path, options, true);
      }
    } catch (_) {
      // ignore
    }
  }

  return { res, data };
}

// Convenience helpers (some pages use apiGet/apiPost)
async function apiGet(path) {
  const { res, data } = await apiFetch(path, { method: 'GET' });
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) ? (data.message || data.error) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function apiPost(path, body) {
  const { res, data } = await apiFetch(path, { method: 'POST', body: JSON.stringify(body || {}) });
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) ? (data.message || data.error) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}
