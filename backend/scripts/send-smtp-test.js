require('dotenv').config();

const crypto = require('crypto');

const { emailDeliveryMode, smtpConfigured } = require('../utils/runtime');
const { closeTransporter, sendEmail, verifySmtpConnection } = require('../utils/mailer');

function testRecipient() {
  return String(process.env.SMTP_TEST_TO || '').trim();
}

async function main() {
  const to = testRecipient();
  if (!to) {
    throw new Error('SMTP_TEST_TO is required so the delivery test has an explicit recipient.');
  }
  if (!smtpConfigured()) {
    throw new Error(
      'SMTP is incomplete. Set SMTP_HOST, SMTP_FROM (or SMTP_USER), and SMTP_PASSWORD when SMTP_USER is used.'
    );
  }
  if (emailDeliveryMode() !== 'smtp') {
    throw new Error('EMAIL_DELIVERY_MODE must resolve to smtp. Set AUTH_DEMO_MODE=false and EMAIL_DELIVERY_MODE=smtp.');
  }

  const testId = crypto.randomUUID();
  await verifySmtpConnection();
  const result = await sendEmail({
    to,
    subject: `[BeautyCare] SMTP delivery test ${testId}`,
    text: `BeautyCare SMTP delivery test. Test ID: ${testId}`,
    html: `<p>BeautyCare SMTP delivery test.</p><p>Test ID: <code>${testId}</code></p>`,
    meta: { type: 'smtp_delivery_test', testId }
  });

  if (result.mode !== 'smtp') {
    throw new Error(`No SMTP delivery was confirmed (mode=${result.mode || 'unknown'}).`);
  }

  console.log(
    `[smtp] Delivery accepted by SMTP. messageId=${result.messageId || 'n/a'} accepted=${result.accepted.length}`
  );
}

main()
  .catch((error) => {
    console.error(`[smtp] Delivery test failed: ${error?.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => {
    closeTransporter();
  });
