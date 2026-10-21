const crypto = require('crypto');
const { httpsEnabled, httpsEnforced } = require('./runtime');

function base64url(buf) {
  return (Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf)))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomToken(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

function sha256(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}

function csrfSecret() {
  const secret = String(process.env.CSRF_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret || secret.length < 32) {
    throw new Error('CSRF_SECRET or JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

function csrfSignature(sessionId, nonce) {
  return base64url(
    crypto.createHmac('sha256', csrfSecret()).update(`${sessionId}.${nonce}`).digest()
  );
}

function createCsrfToken(sessionId) {
  const normalizedSession = String(sessionId || '').trim();
  if (!normalizedSession) return randomToken(32);
  const nonce = base64url(crypto.randomBytes(24));
  return `v1.${base64url(normalizedSession)}.${nonce}.${csrfSignature(normalizedSession, nonce)}`;
}

function verifyCsrfToken(token, sessionId) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const [, encodedSession, nonce, signature] = parts;
  let tokenSession;
  try {
    tokenSession = Buffer.from(encodedSession, 'base64url').toString('utf8');
  } catch (_) {
    return false;
  }
  if (!tokenSession || tokenSession !== String(sessionId || '') || !/^[A-Za-z0-9_-]{20,}$/.test(nonce)) return false;
  let expected;
  try {
    expected = csrfSignature(tokenSession, nonce);
  } catch (_) {
    return false;
  }
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  return actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function isProd() {
  return (process.env.NODE_ENV || 'development') === 'production';
}

function cookieSecure() {
  if (String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true') return true;
  if (httpsEnabled() || httpsEnforced()) return true;
  return isProd();
}

function cookieDomain() {
  return process.env.COOKIE_DOMAIN || undefined;
}

function durationToMs(value, fallbackMs) {
  // Supports formats like: 10m, 2h, 1d
  if (!value) return fallbackMs;
  const s = String(value).trim();
  const m = s.match(/^([0-9]+)([mhd])$/i);
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return fallbackMs;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 60 * 60 * 1000;
  if (unit === 'd') return n * 24 * 60 * 60 * 1000;
  return fallbackMs;
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  const secure = cookieSecure();
  const domain = cookieDomain();
  const accessMaxAge = durationToMs(process.env.ACCESS_TOKEN_TTL, 60 * 60 * 1000);
  const refreshMaxAge = durationToMs(
    process.env.REFRESH_TOKEN_TTL,
    durationToMs(process.env.REFRESH_TOKEN_DAYS ? `${process.env.REFRESH_TOKEN_DAYS}d` : '', 60 * 60 * 1000)
  );

  if (accessToken) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      domain,
      path: '/',
      maxAge: accessMaxAge
    });
  }

  if (refreshToken) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      secure,
      domain,
      path: '/api/auth',
      maxAge: refreshMaxAge
    });
  }
}

function clearAuthCookies(res) {
  const secure = cookieSecure();
  const domain = cookieDomain();

  const base = { secure, domain };

  res.clearCookie('access_token', { ...base, path: '/' });
  res.clearCookie('refresh_token', { ...base, path: '/api/auth' });
}

function setCsrfCookie(res, token) {
  const secure = cookieSecure();
  const domain = cookieDomain();

  res.cookie('csrf_token', token, {
    httpOnly: false,
    sameSite: 'Lax',
    secure,
    domain,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });
}

module.exports = {
  durationToMs,
  randomToken,
  sha256,
  createCsrfToken,
  verifyCsrfToken,
  csrfSecret,
  isProd,
  setAuthCookies,
  clearAuthCookies,
  setCsrfCookie
};
