const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./auth');
const { sha256, verifyCsrfToken } = require('../utils/security');

function sessionIdFromRequest(req) {
  const access = req.cookies?.access_token;
  if (access) {
    try {
      const decoded = jwt.verify(access, JWT_SECRET);
      if (decoded?.jti) return `access:${decoded.jti}`;
    } catch (_) {
      // Fall through to the refresh-token binding. The auth middleware will
      // still reject an invalid access token later in the request pipeline.
    }
  }
  const refresh = req.cookies?.refresh_token;
  return refresh ? `refresh:${sha256(refresh)}` : '';
}

function csrfProtect(req, res, next) {
  const method = (req.method || '').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  // Only enforce when cookies are used (session via cookies).
  const hasSessionCookie = Boolean(req.cookies?.access_token || req.cookies?.refresh_token);
  if (!hasSessionCookie) return next();

  const csrfCookie = req.cookies?.csrf_token;
  const csrfHeader = req.headers['x-csrf-token'];
  const sessionId = sessionIdFromRequest(req);

  if (!csrfCookie || !csrfHeader || !sessionId || String(csrfCookie) !== String(csrfHeader) || !verifyCsrfToken(csrfHeader, sessionId)) {
    return res.status(403).json({ message: 'CSRF token missing or invalid' });
  }
  next();
}

module.exports = { csrfProtect };
