const nodemailer = require('nodemailer');

const { writeOutboxMessage } = require('./outbox');
const { emailDeliveryMode, isTrue } = require('./runtime');

let cachedTransporter;
let cachedKey;

function optionalPositiveNumber(name) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function smtpConfig() {
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  // Do not remove internal whitespace from a password. It is valid for many
  // SMTP providers and stripping it silently changes the configured secret.
  const password = String(process.env.SMTP_PASSWORD || '').trim();

  const config = {
    host: String(process.env.SMTP_HOST || '').trim(),
    port,
    secure: isTrue(process.env.SMTP_SECURE),
    pool: isTrue(process.env.SMTP_POOL)
  };

  if (user) {
    config.auth = {
      user,
      pass: password
    };
  }

  if (process.env.SMTP_REQUIRE_TLS !== undefined) {
    config.requireTLS = isTrue(process.env.SMTP_REQUIRE_TLS);
  }

  if (process.env.SMTP_IGNORE_TLS !== undefined) {
    config.ignoreTLS = isTrue(process.env.SMTP_IGNORE_TLS);
  }

  if (process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== undefined) {
    config.tls = {
      rejectUnauthorized: isTrue(process.env.SMTP_TLS_REJECT_UNAUTHORIZED)
    };
  }

  // Explicit timeouts keep a mail outage from holding an API request open for
  // Node's long socket defaults. Values are optional and expressed in ms.
  const connectionTimeout = optionalPositiveNumber('SMTP_CONNECTION_TIMEOUT_MS');
  const greetingTimeout = optionalPositiveNumber('SMTP_GREETING_TIMEOUT_MS');
  const socketTimeout = optionalPositiveNumber('SMTP_SOCKET_TIMEOUT_MS');
  if (connectionTimeout) config.connectionTimeout = connectionTimeout;
  if (greetingTimeout) config.greetingTimeout = greetingTimeout;
  if (socketTimeout) config.socketTimeout = socketTimeout;

  return config;
}

function smtpCacheKey() {
  return JSON.stringify({
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT || '',
    secure: process.env.SMTP_SECURE || '',
    user: process.env.SMTP_USER || '',
    requireTLS: process.env.SMTP_REQUIRE_TLS || '',
    ignoreTLS: process.env.SMTP_IGNORE_TLS || '',
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED || '',
    pool: process.env.SMTP_POOL || '',
    connectionTimeout: process.env.SMTP_CONNECTION_TIMEOUT_MS || '',
    greetingTimeout: process.env.SMTP_GREETING_TIMEOUT_MS || '',
    socketTimeout: process.env.SMTP_SOCKET_TIMEOUT_MS || ''
  });
}

function fromAddress() {
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  const name = String(process.env.SMTP_FROM_NAME || '').trim();
  if (!name) return from;
  return `"${name.replace(/"/g, '\\"')}" <${from}>`;
}

function recipientLabel(to) {
  const list = Array.isArray(to) ? to : String(to || '').split(',');
  return list.map((item) => String(item || '').trim()).filter(Boolean).join(',');
}

function logMail(level, message, data = {}) {
  const payload = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  const line = payload ? `[mailer] ${message} ${payload}` : `[mailer] ${message}`;
  const fn = console[level] || console.info;
  fn(line);
}

async function transporter() {
  const nextKey = smtpCacheKey();
  if (!cachedTransporter || cachedKey !== nextKey) {
    cachedTransporter = nodemailer.createTransport(smtpConfig());
    cachedKey = nextKey;
  }
  return cachedTransporter;
}

/**
 * Opens and authenticates an SMTP connection without delivering a message.
 * This is intentionally exported for the deployment smoke script; it never
 * includes credentials in its output.
 */
async function verifySmtpConnection() {
  const tx = await transporter();
  await tx.verify();
  logMail('info', 'mode=smtp status=verified', {
    host: String(process.env.SMTP_HOST || '').trim(),
    port: process.env.SMTP_PORT || 587
  });
  return { ok: true };
}

function fallbackToOutbox() {
  if (process.env.EMAIL_FALLBACK_TO_OUTBOX === undefined) return true;
  return isTrue(process.env.EMAIL_FALLBACK_TO_OUTBOX);
}

async function writeFallbackMessage({ to, subject, text, html, meta }) {
  const outbox = await writeOutboxMessage({
    channel: 'email',
    to,
    subject,
    text,
    meta: {
      ...(meta || {}),
      html: html || null
    }
  });

  return {
    mode: 'outbox',
    fileName: outbox.fileName,
    filePath: outbox.filePath
  };
}

async function sendEmail({ to, subject, text, html, meta }) {
  const mode = emailDeliveryMode();
  if (mode !== 'smtp') {
    const fallback = await writeFallbackMessage({ to, subject, text, html, meta });
    logMail('info', 'mode=outbox', {
      to: recipientLabel(to),
      subject,
      file: fallback.fileName
    });
    return fallback;
  }

  try {
    if (String(process.env.SMTP_HOST || '').includes('gmail') && !String(process.env.SMTP_PASSWORD || '').trim()) {
      logMail('warn', 'mode=smtp warning=missing_gmail_app_password', {
        user: String(process.env.SMTP_USER || '').trim()
      });
    }

    const tx = await transporter();
    const info = await tx.sendMail({
      from: fromAddress(),
      to,
      replyTo: String(process.env.SMTP_REPLY_TO || '').trim() || undefined,
      subject,
      text,
      html
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.length > 0 || accepted.length === 0) {
      const rejectedSummary = rejected.length ? rejected.join(',') : 'no recipient accepted';
      const error = new Error(`SMTP rejected recipient(s): ${rejectedSummary}`);
      error.code = 'SMTP_RECIPIENT_REJECTED';
      throw error;
    }

    logMail('info', 'mode=smtp', {
      to: recipientLabel(to),
      subject,
      messageId: info.messageId || ''
    });

    return {
      mode: 'smtp',
      messageId: info.messageId || null,
      accepted,
      rejected
    };
  } catch (error) {
    if (!fallbackToOutbox()) {
      logMail('error', 'mode=smtp status=failed fallback=false', {
        to: recipientLabel(to),
        subject,
        error: error.message || String(error)
      });
      throw error;
    }

    const fallback = await writeFallbackMessage({
      to,
      subject,
      text,
      html,
      meta: {
        ...(meta || {}),
        smtpError: error.message || String(error)
      }
    });

    logMail('warn', 'mode=outbox_fallback', {
      to: recipientLabel(to),
      subject,
      file: fallback.fileName,
      error: error.message || String(error)
    });

    return {
      mode: 'outbox_fallback',
      fileName: fallback.fileName,
      filePath: fallback.filePath
    };
  }
}

function resetTransporterForTests() {
  if (cachedTransporter && typeof cachedTransporter.close === 'function') {
    cachedTransporter.close();
  }
  cachedTransporter = null;
  cachedKey = null;
}

function closeTransporter() {
  if (cachedTransporter && typeof cachedTransporter.close === 'function') {
    cachedTransporter.close();
  }
  cachedTransporter = null;
  cachedKey = null;
}

module.exports = {
  sendEmail,
  verifySmtpConnection,
  closeTransporter,
  resetTransporterForTests
};
