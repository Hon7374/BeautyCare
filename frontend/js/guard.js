(function () {
  const isAdminPage = location.pathname.includes('/admin/');
  const isUserPage = location.pathname.includes('/user/');
  const isProtected = isAdminPage || isUserPage || location.pathname.endsWith('dashboard.html');
  if (!isProtected) return;

  const loginPath = (isAdminPage || isUserPage) ? '../login.html' : 'login.html';
  const protocol = (location && location.protocol) ? location.protocol : 'http:';
  const host = (location && location.hostname) ? location.hostname : 'localhost';
  const API_BASE = window.API || `${protocol}//${host}:3000/api`;

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  }

  async function refreshIfPossible() {
    try {
      if (!getCookie('refresh_token')) return false;
      let csrf = getCookie('csrf_token') || '';
      if (!csrf) {
        try {
          const t = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
          const j = await t.json().catch(() => null);
          csrf = (j && j.csrfToken) ? j.csrfToken : (getCookie('csrf_token') || '');
        } catch (_) {
          csrf = '';
        }
      }
      const rr = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf }
      });
      return rr.ok;
    } catch (_) {
      return false;
    }
  }

  async function loadMe() {
    const token = (() => { try { return localStorage.getItem('token'); } catch (_) { return null; } })();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const r = await fetch(`${API_BASE}/auth/me`, { credentials: 'include', headers });
    if (r.ok) return r.json();

    // If cookie access token expired, try refresh (cookie-based) then retry.
    if (r.status === 401) {
      const ok = await refreshIfPossible();
      if (ok) {
        const r2 = await fetch(`${API_BASE}/auth/me`, { credentials: 'include', headers });
        if (r2.ok) return r2.json();
      }
    }
    throw new Error('UNAUTH');
  }

  loadMe()
    .then((user) => {
      localStorage.setItem('user', JSON.stringify(user));
      if (isAdminPage && user.role !== 'admin') {
        window.location.href = '../index.html';
      }
    })
    .catch(() => {
      localStorage.removeItem('user');
      window.location.href = loginPath;
    });
})();
