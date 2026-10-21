const jwt = require('jsonwebtoken');
const db = require('../db');

// Authentication must be configured explicitly. A hard-coded fallback would
// make every deployment share a forgeable signing key.
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();

async function isRevoked(jti) {
  if (!jti) return false;
  try {
    const pool = await db.connect();
    const rs = await pool
      .request()
      .input('jti', db.sql.NVarChar, String(jti))
      .query(
        `
        SELECT TOP (1) id
        FROM revoked_tokens
        WHERE jti=@jti AND expires_at > GETDATE()
        `
      );
    return rs.recordset.length > 0;
  } catch (e) {
    // If table doesn't exist yet, don't block demo; but log for development.
    console.warn('⚠️ revoked_tokens check failed (table missing?)', e?.message || e);
    return false;
  }
}

async function verify(req, res, next) {
  const auth = req.headers.authorization || '';
  const headerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const cookieToken = req.cookies?.access_token || null;
  const token = headerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'Thiếu token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded: { id, role, jti, exp, iat }
    if (decoded?.jti && (await isRevoked(decoded.jti))) {
      return res.status(401).json({ message: 'Token đã bị thu hồi. Vui lòng đăng nhập lại.' });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      jti: decoded.jti,
      exp: decoded.exp
    };
    req.token = token;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

function admin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền truy cập' });
  }
  next();
}

module.exports = { verify, admin, JWT_SECRET };
