// auth.js - handles auth + security flows (safe for CSP: no inline handlers)

const AUTH_API_BASE =
  window.API || `${window.location.protocol}//${window.location.hostname}:3000/api`;
const FRONTEND_ROOT = (window.FRONTEND_URL || window.location.origin).replace(/\/+$/, '');

function authApiUrl(path) {
  return `${AUTH_API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

function frontUrl(path) {
  return `${FRONTEND_ROOT}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Helper: POST JSON
async function postJson(url, data, opts = {}) {
  // Attach CSRF token when cookies are used (double-submit).
  const getCookie = (name) => {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  };

  // Ensure csrf_token cookie exists (backend provides /api/auth/csrf)
  let csrf = getCookie('csrf_token');
  if (!csrf) {
    try {
      const r = await fetch(authApiUrl('/auth/csrf'), { credentials: 'include' });
      const j = await r.json().catch(() => null);
      csrf = j?.csrfToken || getCookie('csrf_token');
    } catch (_) {
      csrf = getCookie('csrf_token');
    }
  }

  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(data || {})
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || json?.error || `HTTP ${res.status}`;
    const error = new Error(msg);
    error.code = json?.code || null;
    error.status = res.status;
    throw error;
  }
  return json;
}

function qs(id) { return document.getElementById(id); }

// ---- Core auth ----
async function login() {
  try {
    const email = (qs('email')?.value || '').trim();
    const password = (qs('password')?.value || '').trim();
    const otp = (qs('otp')?.value || '').trim();
    const otpBox = qs('otpBox');

    if (!email || !password) {
      window.toast?.('warn', 'Missing info', 'Please enter email/phone and password.');
      return;
    }

    const payload = { email, password };
    if (otp) payload.otp = otp;

    const data = await postJson(authApiUrl('/auth/login'), payload);

    // Some builds return user in body; cookies set by server.
    const user = data?.user || null;
    const token = data?.token || null;
    if (user) localStorage.setItem('user', JSON.stringify(user));
    if (token) localStorage.setItem('token', String(token));
    if (otpBox) otpBox.style.display = 'none';
    if (qs('otp')) qs('otp').value = '';
    window.toast?.('good', 'Success', 'Logged in successfully.');

    // Redirect by role
    if (user?.role === 'admin') window.location.href = frontUrl('/admin/users.html');
    else window.location.href = frontUrl('/user/services.html');
  } catch (e) {
    const otpBox = qs('otpBox');
    if (e?.code === 'TWO_FA_REQUIRED' || e?.code === 'TWO_FA_INVALID') {
      if (otpBox) otpBox.style.display = 'block';
      if (e?.code === 'TWO_FA_REQUIRED') {
        window.toast?.('warn', '2FA required', e.message || 'Please enter the 6-digit OTP code.');
      } else {
        window.toast?.('bad', 'Invalid 2FA', e.message || 'The OTP code is invalid.');
      }
      qs('otp')?.focus();
      return;
    }
    window.toast?.('bad', 'Login failed', e.message || 'Something went wrong.');
  }
}

async function register() {
  try {
    const name = (qs('name')?.value || '').trim();
    const phone = (qs('phone')?.value || '').trim();
    const email = (qs('email')?.value || '').trim();
    const password = (qs('password')?.value || '').trim();

    if (!name || !phone || !password) {
      window.toast?.('warn', 'Missing info', 'Please fill name, phone, and password.');
      return;
    }

    const data = await postJson(authApiUrl('/auth/register'), { name, phone, email: (email || null), password });
    const user = data?.user || null;
    const token = data?.token || null;
    if (user) localStorage.setItem('user', JSON.stringify(user));
    if (token) localStorage.setItem('token', String(token));
    window.toast?.('good', 'Success', 'Account created successfully.');

    window.location.href = frontUrl('/user/services.html');
  } catch (e) {
    window.toast?.('bad', 'Register failed', e.message || 'Something went wrong.');
  }
}

async function logout() {
  try {
    // Include CSRF token if present
    const m = document.cookie.match(/(^| )csrf_token=([^;]+)/);
    const csrf = m ? decodeURIComponent(m[2]) : '';
    await fetch(authApiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {}
    }).catch(() => {});
  } finally {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = frontUrl('/login.html');
  }
}

// ---- Password reset ----
async function sendResetLink() {
  try {
    const email = (qs('email')?.value || '').trim();
    if (!email) {
      window.toast?.('warn', 'Missing email', 'Enter an email to create a reset link.');
      return;
    }
    const data = await postJson(authApiUrl('/auth/forgot-password'), { email });

    // Demo mode: backend may return token
    if (data?.token) {
      const resetUrl = data?.actionUrl || `${frontUrl('/reset.html')}?token=${encodeURIComponent(data.token)}`;
      window.toast?.('good', 'Reset link ready', 'A reset link was generated for demo mode.');
      const out = qs('resetLinkOut');
      if (out) out.value = resetUrl;
    } else {
      window.toast?.('good', 'Success', 'If the email exists, reset instructions were sent.');
    }
  } catch (e) {
    window.toast?.('bad', 'Error', e.message || 'Could not send reset link.');
  }
}

async function doResetPassword() {
  try {
    const token = (new URLSearchParams(location.search)).get('token') || (qs('token')?.value || '').trim();
    const password = (qs('password')?.value || '').trim();
    const password2 = (qs('password2')?.value || '').trim();

    if (!token) {
      window.toast?.('warn', 'Missing token', 'Reset token is required.');
      return;
    }
    if (!password || password.length < 6) {
      window.toast?.('warn', 'Weak password', 'Password must be at least 6 characters.');
      return;
    }
    if (password2 && password !== password2) {
      window.toast?.('warn', 'Mismatch', 'Password confirmation does not match.');
      return;
    }

    await postJson(authApiUrl('/auth/reset-password'), { token, new_password: password });
    window.toast?.('good', 'Success', 'Password reset succeeded. Please log in again.');
    window.location.href = frontUrl('/login.html');
  } catch (e) {
    window.toast?.('bad', 'Error', e.message || 'Could not reset password.');
  }
}

// Expose for other scripts that call logout() etc
window.login = login;
window.register = register;
window.logout = logout;
window.sendResetLink = sendResetLink;
window.doResetPassword = doResetPassword;

// ---- Auto bind (NO inline handlers) ----
document.addEventListener('DOMContentLoaded', () => {
  const emailVerified = new URLSearchParams(window.location.search).get('emailVerified');
  if (emailVerified === 'success') {
    window.toast?.('good', 'Đã xác minh email', 'Email của bạn đã được xác minh. Hãy đăng nhập để tiếp tục.');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (emailVerified === 'invalid' || emailVerified === 'error') {
    window.toast?.('bad', 'Không thể xác minh email', 'Liên kết không hợp lệ, đã dùng hoặc đã hết hạn.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const bindClick = (id, fn) => {
    const el = document.getElementById(id);
    if (!el || typeof fn !== 'function') return;
    el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  };

  bindClick('btnLogin', window.login);
  bindClick('btnRegister', window.register);
  bindClick('btnSendReset', window.sendResetLink);
  bindClick('btnDoReset', window.doResetPassword);

  // Security page features may be defined in security.js; access via window.* to avoid ReferenceError
  bindClick('btnRequestVerifyEmail', window.requestVerifyEmail);
  bindClick('btnVerifyEmailToken', window.verifyEmailToken);
  bindClick('btnSetup2FA', window.setup2fa);
  bindClick('btnEnable2FA', window.enable2fa);
  bindClick('btnDisable2FA', window.disable2fa);

  document.querySelectorAll('.js-logout').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); window.logout(); });
  });
});
