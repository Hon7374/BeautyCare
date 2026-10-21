require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const { csrfProtect } = require('./middleware/csrf');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');
const { logger } = require('./utils/logger');
const {
  allowedCorsOrigins,
  hstsEnabled,
  hstsIncludeSubDomains,
  hstsMaxAge,
  hstsPreload,
  httpsEnforced,
  isProduction,
  runtimeProfile,
  trustedProxy,
  apiRateLimit,
  performanceTestMode
} = require('./utils/runtime');

const app = express();
// X-Forwarded-Proto is trusted only when a deployment explicitly declares a
// proxy.  Trusting it unconditionally lets a direct client forge HTTPS.
app.set('trust proxy', trustedProxy());

// Stripe webhook needs raw body for signature verification.
// This must be registered BEFORE express.json().
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));

// Request ID (correlation id)
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging. Local performance runs keep security/error logging but omit
// per-request console+file writes, which otherwise become a benchmark I/O
// bottleneck. Development/production defaults remain unchanged.
const requestLogStream = performanceTestMode()
  ? { write: () => {} }
  : { write: (message) => logger.info(message.trim()) };
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: requestLogStream }));

if (httpsEnforced()) {
  app.use((req, res, next) => {
    if (req.secure) return next();

    const host = req.headers.host;
    if (!host) return res.status(400).json({ message: 'HTTPS is required' });
    return res.redirect(308, `https://${host}${req.originalUrl}`);
  });
}

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    strictTransportSecurity: hstsEnabled()
      ? {
          maxAge: hstsMaxAge(),
          includeSubDomains: hstsIncludeSubDomains(),
          preload: hstsPreload()
        }
      : false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'none'"],
        "script-src": ["'self'", "https://cdn.jsdelivr.net"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "style-src-elem": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "style-src-attr": ["'unsafe-inline'"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": isProduction() ? ["'self'", "data:", "blob:", "https:"] : ["'self'", "data:", "blob:", "https:", "http:"],
        "connect-src": isProduction() ? ["'self'"] : ["'self'", "http://localhost:*", "https://localhost:*"],
        "upgrade-insecure-requests": httpsEnforced() ? [] : null
      }
    }
  })
);

// CORS
const corsOrigins = new Set(allowedCorsOrigins());
const productionMode = isProduction();

if (productionMode && corsOrigins.size === 0) {
  logger.warn('CORS_ORIGINS is empty or invalid in production; cross-origin browser requests will be denied.');
}

app.use(
  cors({
    origin: (origin, cb) => {
      // If no Origin header (same-origin navigation, curl, etc.) allow.
      if (!origin) return cb(null, true);

      // Localhost is a development convenience only.  It is deliberately not
      // accepted in production unless an exact localhost origin is explicitly
      // listed in CORS_ORIGINS.
      const isLocal =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
        /^https?:\/\/\[::1\](?::\d+)?$/i.test(origin);

      if (!productionMode && isLocal) return cb(null, true);

      // An unconfigured allowlist remains convenient for the local demo, but
      // fails closed in production.  Credentials are enabled, so a wildcard
      // origin must never be used here.
      if (!productionMode && corsOrigins.size === 0) return cb(null, true);

      // Allow only exact configured origins (scheme + host + port).
      if (corsOrigins.has(origin)) return cb(null, true);

      return cb(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
  })
);

// Body parsing with size limit
// NOTE: Stripe webhook uses express.raw() earlier, so we must skip JSON parsing for that path.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/stripe/webhook') return next();
  const jsonLimit = req.originalUrl.startsWith('/api/admin/services/upload-image') ? '6mb' : '100kb';
  return express.json({ limit: jsonLimit })(req, res, next);
});
app.use(cookieParser());

// CSRF protection
app.use('/api', csrfProtect);

// Metrics (optional)
if (String(process.env.METRICS || '').toLowerCase() === 'true') {
  app.use(metricsMiddleware);
  app.get('/api/metrics', async (req, res) => {
    const key = process.env.METRICS_KEY;
    if (key && String(req.headers['x-metrics-key'] || '') !== String(key)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return metricsHandler(req, res);
  });
}

// Rate limit
const apiLimiter = rateLimit({
  ...apiRateLimit(),
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Health
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    profile: runtimeProfile()
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/services', require('./routes/services'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
// -------------------------------
// Serve Frontend (no Live Server needed)
// -------------------------------
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// Helpful default: open home page at http://localhost:<PORT>/
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// For deep links (e.g., /user/payment-result.html), express.static will serve the file if it exists.
// If the browser requests an unknown non-API route, fall back to index.html (keeps demo smooth).
app.get(/^\/(?!api).*/, (req, res, next) => {
  // Only for GET HTML navigations
  const accept = String(req.headers.accept || '');
  if (!accept.includes('text/html')) return next();
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});


// 404
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({ message: 'CORS blocked. Configure CORS_ORIGINS in backend/.env' });
  }
  logger.error('UNHANDLED_ERROR', { requestId: req.id, error: err?.message, stack: err?.stack });
  res.status(500).json({ message: 'Server error' });
});

module.exports = app;
