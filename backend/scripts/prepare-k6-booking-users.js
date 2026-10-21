require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../db');

const count = Math.max(1, Math.min(200, Number(process.env.K6_TEST_USERS || 50)));
const prefix = 'iccIT-k6-booking-';
const password = String(process.env.K6_TEST_PASSWORD || '');

if (!String(db.config.database || '').toLowerCase().includes('test')) {
  throw new Error(`REFUSING_NON_TEST_DATABASE:${db.config.database}`);
}
if (password.length < 12) throw new Error('K6_TEST_PASSWORD must be at least 12 characters');

(async () => {
  const pool = await db.connect();
  const hash = await bcrypt.hash(password, 10);
  await pool.request().input('prefix', db.sql.NVarChar, `${prefix}%`).query('DELETE FROM bookings WHERE user_id IN (SELECT id FROM users WHERE email LIKE @prefix)');
  await pool.request().input('prefix', db.sql.NVarChar, `${prefix}%`).query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE @prefix)');
  await pool.request().input('prefix', db.sql.NVarChar, `${prefix}%`).query('DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE @prefix)');
  await pool.request().input('prefix', db.sql.NVarChar, `${prefix}%`).query('DELETE FROM users WHERE email LIKE @prefix');

  for (let index = 0; index < count; index += 1) {
    const suffix = String(index + 1).padStart(3, '0');
    await pool.request()
      .input('name', db.sql.NVarChar, `ICCIT k6 client ${suffix}`)
      .input('phone', db.sql.NVarChar, `0987${String(index + 1).padStart(6, '0')}`)
      .input('email', db.sql.NVarChar, `${prefix}${suffix}@example.test`)
      .input('password', db.sql.NVarChar, hash)
      .query(`
        INSERT INTO users (name, phone, email, password, role, member, email_verified, twofa_enabled)
        VALUES (@name, @phone, @email, @password, 'user', 'silver', 1, 0)
      `);
  }
  console.log(JSON.stringify({ database: db.config.database, users: count, emailPrefix: prefix }));
  await db.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
