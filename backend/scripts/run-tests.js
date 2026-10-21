const { spawnSync } = require('child_process');
const path = require('path');

const db = require('../db');

const mode = String(process.argv[2] || 'demo').trim().toLowerCase();
const rootDir = path.join(__dirname, '..');
const jestBin = path.join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js');

const smokeSuites = [
  'tests/smoke.test.js',
  'tests/mailer.test.js',
  'tests/booking-mailer.test.js',
  'tests/smtp.transport.integration.test.js',
  'tests/security.no-db.test.js',
  'tests/service-image-upload.test.js',
  'tests/admin.users.no-db.test.js',
  'tests/payments.subscription-change.no-db.test.js',
  'tests/payment-mock-xss.no-db.test.js',
  'tests/security-html-sanitizer.no-db.test.js',
  'tests/check-semgrep-result.no-db.test.js',
  'tests/booking-validation.no-db.test.js',
  'tests/payment-input-validation.no-db.test.js'
];
const dbSuites = [
  'tests/security.auth-flow.test.js',
  'tests/vnpay-duplicate-callback.integration.test.js',
  'tests/vnpay-ipn.integration.test.js',
  'tests/payment-atomicity.integration.test.js'
];

function runJest(suites) {
  const result = spawnSync(process.execPath, [jestBin, '--runInBand', ...suites], {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (typeof result.status === 'number') return result.status;
  return 1;
}

async function dbAvailable() {
  try {
    await db.connect();
    await db.close();
    return true;
  } catch (_) {
    await db.close().catch(() => {});
    return false;
  }
}

function printDbRequirement() {
  console.log(
    '[tests] MySQL is required for integration/security tests. Import database/beautycare.mysql.sql and configure backend/.env before running `npm run test:db`.'
  );
}

async function main() {
  if (!['demo', 'smoke', 'db', 'all'].includes(mode)) {
    console.error(`[tests] Unknown mode: ${mode}`);
    process.exit(1);
  }

  if (mode === 'smoke') {
    console.log('[tests] Running smoke/unit suites (no DB required)...');
    process.exit(runJest(smokeSuites));
  }

  if (mode === 'db') {
    if (!(await dbAvailable())) {
      printDbRequirement();
      process.exit(1);
    }
    console.log('[tests] Running DB-backed integration/security suite...');
    process.exit(runJest(dbSuites));
  }

  console.log('[tests] Running smoke/unit suites (no DB required)...');
  const smokeStatus = runJest(smokeSuites);
  if (smokeStatus !== 0) {
    process.exit(smokeStatus);
  }

  const hasDb = await dbAvailable();
  if (!hasDb) {
    if (mode === 'all') {
      printDbRequirement();
      process.exit(1);
    }

    console.log('[tests] Smoke/unit suites passed.');
    console.log('[tests] DB integration/security suite skipped because MySQL is not reachable.');
    printDbRequirement();
    process.exit(0);
  }

  console.log('[tests] Running DB-backed integration/security suite...');
  process.exit(runJest(dbSuites));
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
