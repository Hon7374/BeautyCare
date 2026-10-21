require('dotenv').config();

const { emailDeliveryMode, smtpConfigured } = require('../utils/runtime');
const { closeTransporter, verifySmtpConnection } = require('../utils/mailer');

async function main() {
  if (!smtpConfigured()) {
    throw new Error(
      'SMTP is incomplete. Set SMTP_HOST, SMTP_FROM (or SMTP_USER), and SMTP_PASSWORD when SMTP_USER is used.'
    );
  }
  if (emailDeliveryMode() !== 'smtp') {
    throw new Error('EMAIL_DELIVERY_MODE must resolve to smtp. Set AUTH_DEMO_MODE=false and EMAIL_DELIVERY_MODE=smtp.');
  }

  await verifySmtpConnection();
  console.log('[smtp] Connection and authentication verified. No email was sent by this command.');
}

main()
  .catch((error) => {
    console.error(`[smtp] Verification failed: ${error?.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => {
    closeTransporter();
  });
