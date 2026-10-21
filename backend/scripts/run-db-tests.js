const { spawnSync } = require('child_process');

const env = {
  ...process.env,
  DB_NAME: process.env.DB_TEST_NAME || 'beautycare_test',
  DATABASE_NAME: process.env.DB_TEST_NAME || 'beautycare_test'
};

const init = spawnSync(process.execPath, [require.resolve('./init-test-database.js')], { env, stdio: 'inherit' });
if (init.status !== 0) process.exit(init.status || 1);

const test = spawnSync(process.execPath, [require.resolve('./run-tests.js'), 'db'], { env, stdio: 'inherit' });
process.exit(typeof test.status === 'number' ? test.status : 1);
