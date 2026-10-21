const fs = require('fs');
const path = require('path');

const OUTBOX_DIR = path.join(__dirname, '..', 'outbox');

async function ensureOutboxDir() {
  await fs.promises.mkdir(OUTBOX_DIR, { recursive: true });
}

async function writeOutboxMessage({ channel = 'email', to, subject, text, meta }) {
  await ensureOutboxDir();

  const timestamp = new Date();
  const safeIso = timestamp.toISOString().replace(/[:.]/g, '-');
  const slug = String(subject || channel)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || channel;
  const fileName = `${safeIso}-${slug}.json`;
  const filePath = path.join(OUTBOX_DIR, fileName);

  const payload = {
    createdAt: timestamp.toISOString(),
    channel,
    to,
    subject,
    text,
    meta: meta || {}
  };

  await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

  return {
    fileName,
    filePath
  };
}

module.exports = {
  OUTBOX_DIR,
  writeOutboxMessage
};
