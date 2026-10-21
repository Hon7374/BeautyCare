function isTrue(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function isProduction() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function authDemoMode() {
  return isTrue(process.env.AUTH_DEMO_MODE);
}

function httpsEnabled() {
  return isTrue(process.env.HTTPS);
}

function httpsEnforced() {
  // A production deployment must never serve an application session over
  // clear-text HTTP.  Local/demo environments retain the explicit opt-in so
  // developers can use http://localhost without browser HSTS side-effects.
  return isProduction() || isTrue(process.env.ENFORCE_HTTPS);
}

function strictHttps() {
  return isTrue(process.env.STRICT_HTTPS);
}

function trustedProxy() {
  const raw = String(process.env.TRUST_PROXY || '').trim();
  const normalized = raw.toLowerCase();

  // Do not trust X-Forwarded-* by default: otherwise a direct client can
  // forge X-Forwarded-Proto: https and bypass the HTTPS redirect guard.
  if (!raw || ['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', 'yes', 'on'].includes(normalized)) return 1;
  if (/^\d+$/.test(raw)) return Number(raw);

  // Express supports named ranges/IPs (for example "loopback") and a comma
  // separated list.  This value is deployment-owned configuration, not a
  // request value.
  return raw;
}

function hstsEnabled() {
  // HSTS only has value when the browser reaches this application through
  // HTTPS (native TLS or a trusted TLS-terminating proxy).
  return httpsEnabled() || httpsEnforced();
}

function hstsMaxAge() {
  const candidate = Number(process.env.HSTS_MAX_AGE || 31536000);
  // Keep an invalid environment value from silently disabling the policy.
  return Number.isInteger(candidate) && candidate >= 0 ? candidate : 31536000;
}

function hstsIncludeSubDomains() {
  const value = process.env.HSTS_INCLUDE_SUBDOMAINS;
  return value === undefined || value === '' ? true : isTrue(value);
}

function hstsPreload() {
  return isTrue(process.env.HSTS_PRELOAD);
}

function allowedCorsOrigins() {
  return [...new Set(
    (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((value) => value.trim())
      .map((origin) => {
        try {
          const url = new URL(origin);
          // A CORS allowlist is origin-only: paths, query strings and
          // wildcards would otherwise create an unintentionally broad policy.
          if (!['http:', 'https:'].includes(url.protocol)) return null;
          if (url.pathname !== '/' || url.search || url.hash) return null;
          return url.origin;
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean)
  )];
}

function smtpConfigured() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const password = String(process.env.SMTP_PASSWORD || '').trim();
  const hasBasicConfig = Boolean(host && from);

  if (!hasBasicConfig) return false;

  // Gmail and any SMTP account configured with a username need credentials.
  // When the password is missing, use outbox mode instead of attempting a
  // doomed SMTP login and surfacing a noisy "Missing credentials" error.
  if (user && !password) return false;

  return true;
}

function paymentMode() {
  return String(process.env.PAYMENTS_MODE || 'mock').trim().toLowerCase() === 'mock' ? 'mock' : 'real';
}

function emailDeliveryMode() {
  if (authDemoMode()) return 'api_token';
  const mode = String(process.env.EMAIL_DELIVERY_MODE || 'outbox').trim().toLowerCase();
  if (mode === 'smtp') return smtpConfigured() ? 'smtp' : 'outbox';
  if (mode === 'auto') return smtpConfigured() ? 'smtp' : 'outbox';
  if (mode === 'outbox') return mode;
  return smtpConfigured() ? 'smtp' : 'outbox';
}

function publicAppUrl() {
  return String(
    process.env.PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      `http://localhost:${Number(process.env.PORT || 3000)}`
  )
    .trim()
    .replace(/\/+$/, '');
}

function performanceTestMode() {
  if (!isTrue(process.env.PERF_TEST) || isProduction()) return false;
  try {
    const hostname = new URL(publicAppUrl()).hostname.toLowerCase();
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch (_) {
    return false;
  }
}

function apiRateLimit() {
  if (!performanceTestMode()) return { windowMs: 15 * 60 * 1000, limit: 300 };
  const configured = Number(process.env.PERF_TEST_RATE_LIMIT || 1000000);
  return {
    windowMs: 15 * 60 * 1000,
    limit: Number.isInteger(configured) && configured > 300 ? configured : 1000000
  };
}

function runtimeProfile() {
  return {
    app: {
      name: 'BeautyCare',
      scope: 'secure crm and loyalty web commerce for beauty-care services',
      researchScope: 'token auth, online payment, multi-tier discounts, CRM/loyalty, and practical validation for beauty-service ecommerce'
    },
    database: {
      engine: 'mysql',
      driver: 'mysql2',
      theorySurvey: ['mysql', 'mariadb', 'postgresql']
    },
    deployment: {
      httpsEnabled: httpsEnabled(),
      httpsEnforced: httpsEnforced(),
      strictHttps: strictHttps(),
      hstsEnabled: hstsEnabled(),
      trustProxy: trustedProxy() !== false,
      corsAllowlistConfigured: allowedCorsOrigins().length > 0
    },
    auth: {
      demoMode: authDemoMode(),
      emailDelivery: emailDeliveryMode(),
      smtpConfigured: smtpConfigured()
    },
    payments: {
      mode: paymentMode()
    },
    performance: {
      enabled: performanceTestMode()
    }
  };
}

module.exports = {
  isTrue,
  isProduction,
  authDemoMode,
  httpsEnabled,
  httpsEnforced,
  strictHttps,
  trustedProxy,
  hstsEnabled,
  hstsMaxAge,
  hstsIncludeSubDomains,
  hstsPreload,
  allowedCorsOrigins,
  smtpConfigured,
  paymentMode,
  performanceTestMode,
  apiRateLimit,
  emailDeliveryMode,
  publicAppUrl,
  runtimeProfile
};
