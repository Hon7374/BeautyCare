require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');

const app = require('./app');
const { allowedCorsOrigins, httpsEnabled, isProduction, strictHttps, trustedProxy } = require('./utils/runtime');

const PORT = Number(process.env.PORT || 3000);

function probeHealth(requestLib, protocol) {
  return new Promise((resolve) => {
    const req = requestLib.get(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/health',
        timeout: 1500,
        rejectUnauthorized: false
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const payload = JSON.parse(body);
            if (payload && payload.ok === true) {
              return resolve(`${protocol}://localhost:${PORT}`);
            }
          } catch (error) {
            // Ignore invalid payloads and treat them as a non-BeautyCare service.
          }
          return resolve(null);
        });
      }
    );

    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function detectExistingBeautyCare() {
  const httpOrigin = await probeHealth(http, 'http');
  if (httpOrigin) return httpOrigin;
  return probeHealth(https, 'https');
}

function logStartupSuccess(protocol) {
  console.log(`Server running ${protocol}://localhost:${PORT}`);
  if (!process.env.JWT_SECRET) {
    console.log('[warn] JWT_SECRET is not set. Authenticated token issuance will fail closed.');
  }
}

function handleStartupError(error, protocolLabel) {
  if (error && error.code === 'EADDRINUSE') {
    void (async () => {
      const runningOrigin = await detectExistingBeautyCare();
      if (runningOrigin) {
        console.error(`[startup] Port ${PORT} is already serving BeautyCare at ${runningOrigin}.`);
        console.error('[startup] Open that URL directly, or stop the existing server before starting another instance.');
      } else {
        console.error(`[startup] Port ${PORT} is already in use, so ${protocolLabel.toUpperCase()} could not start.`);
        console.error(`[startup] Stop the process using port ${PORT}, or change PORT in backend/.env.`);
      }
      process.exit(1);
    })();
    return;
  }

  console.error(`[startup] Failed to start ${protocolLabel.toUpperCase()} server: ${error.message}`);
  process.exit(1);
}

function startHttp() {
  const server = http.createServer(app);
  server.on('error', (error) => handleStartupError(error, 'http'));
  server.listen(PORT, () => logStartupSuccess('http'));
}

function validateProductionSecurityConfiguration() {
  if (!isProduction()) return true;

  const errors = [];
  if (!httpsEnabled() && trustedProxy() === false) {
    errors.push(
      'Production requires HTTPS=true with a certificate, or TRUST_PROXY configured for a TLS-terminating reverse proxy.'
    );
  }
  if (!allowedCorsOrigins().some((origin) => origin.startsWith('https://'))) {
    errors.push('Production requires at least one exact https:// domain in CORS_ORIGINS.');
  }
  if (!String(process.env.COOKIE_SECURE || '').trim().toLowerCase().match(/^(true|1|yes|on)$/)) {
    errors.push('Production requires COOKIE_SECURE=true so authentication cookies are never sent over HTTP.');
  }
  if (String(process.env.JWT_SECRET || '').trim().length < 32) {
    errors.push('Production requires JWT_SECRET with at least 32 characters.');
  }
  if (String(process.env.CSRF_SECRET || process.env.JWT_SECRET || '').trim().length < 32) {
    errors.push('Production requires CSRF_SECRET or JWT_SECRET with at least 32 characters.');
  }

  if (errors.length === 0) return true;
  errors.forEach((message) => console.error(`[startup] ${message}`));
  return false;
}

if (!validateProductionSecurityConfiguration()) {
  process.exit(1);
}

// Optional HTTPS for production-like deployments.
// Set HTTPS=true and provide SSL_KEY_PATH + SSL_CERT_PATH.
if (httpsEnabled()) {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;
  try {
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);
    const server = https.createServer({ key, cert }, app);
    server.on('error', (error) => handleStartupError(error, 'https'));
    server.listen(PORT, () => logStartupSuccess('https'));
  } catch (e) {
    if (strictHttps() || isProduction()) {
      console.error('HTTPS is enabled for a strict/production deployment, but SSL files are missing or unreadable.');
      process.exit(1);
    }
    console.warn('HTTPS is enabled but SSL files are missing. Falling back to HTTP.');
    startHttp();
  }
} else {
  startHttp();
}
