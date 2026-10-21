require('dotenv').config();

const db = require('../db');

if (!String(db.config.database || '').toLowerCase().includes('test')) {
  throw new Error(`REFUSING_NON_TEST_DATABASE:${db.config.database}`);
}

(async () => {
  const pool = await db.connect();
  const prefix = 'iccIT-k6-booking-%';
  const bookings = await pool.request().input('prefix', db.sql.NVarChar, prefix).query('SELECT COUNT(*) AS count FROM bookings WHERE user_id IN (SELECT id FROM users WHERE email LIKE @prefix)');
  await pool.request().input('prefix', db.sql.NVarChar, prefix).query('DELETE FROM bookings WHERE user_id IN (SELECT id FROM users WHERE email LIKE @prefix)');
  await pool.request().input('prefix', db.sql.NVarChar, prefix).query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE @prefix)');
  await pool.request().input('prefix', db.sql.NVarChar, prefix).query('DELETE FROM audit_logs WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE @prefix)');
  await pool.request().input('prefix', db.sql.NVarChar, prefix).query('DELETE FROM users WHERE email LIKE @prefix');
  console.log(JSON.stringify({ database: db.config.database, deletedBookings: Number(bookings.recordset[0]?.count || 0) }));
  await db.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
