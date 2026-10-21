const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const jestBin = path.join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js');
const logPath = path.resolve(
  rootDir,
  '../docs/03-development/kiem-thu/ICCIT2026/raw-results/vnpay-idempotency/vnpay-duplicate-callback-20261021.console.log'
);

const result = spawnSync(process.execPath, [jestBin, '--runInBand', 'tests/vnpay-duplicate-callback.integration.test.js'], {
  cwd: rootDir,
  encoding: 'utf8'
});
const output = `${result.stdout || ''}${result.stderr || ''}`;
fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, output, 'utf8');
process.stdout.write(output);
process.exit(result.status == null ? 1 : result.status);
