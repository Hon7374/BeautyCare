require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../db');

if (!String(db.config.database || '').toLowerCase().includes('test')) {
  throw new Error(`REFUSING_NON_TEST_DATABASE:${db.config.database}`);
}

const runId = String(process.env.RUN_ID || 'run').replace(/[^a-zA-Z0-9_-]/g, '_');
const workload = String(process.env.WORKLOAD || 'B1').toUpperCase();
const date = String(process.env.TEST_DATE || '2099-12-31');
const time = String(process.env.TEST_TIME || '09:00');
const serviceId = Number(process.env.SERVICE_ID || 1);
const outputPath = path.resolve(
  __dirname,
  `../../docs/03-development/kiem-thu/ICCIT2026/raw-results/k6-booking/${runId}-db-assertion.json`
);

(async () => {
  const pool = await db.connect();
  if (workload === 'B2') {
    const result = await pool.request()
      .input('prefix', db.sql.NVarChar, 'iccIT-k6-booking-%')
      .query(`
        SELECT b.booking_date, b.booking_time, COUNT(*) AS count
        FROM bookings b JOIN users u ON u.id=b.user_id
        WHERE u.email LIKE @prefix
        GROUP BY b.booking_date, b.booking_time
      `);
    const slotCounts = result.recordset.map((row) => ({
      date: String(row.booking_date).slice(0, 10),
      time: String(row.booking_time),
      count: Number(row.count)
    }));
    const artifact = {
      generatedAt: new Date().toISOString(), database: db.config.database, runId, workload,
      totalBookings: slotCounts.reduce((sum, row) => sum + row.count, 0),
      uniqueSlots: slotCounts.length, capacity: 3,
      maxBookingsPerSlot: Math.max(0, ...slotCounts.map((row) => row.count)),
      capacityViolation: slotCounts.some((row) => row.count > 3),
      slotCounts
    };
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');
    console.log(JSON.stringify(artifact));
    await db.close();
    return;
  }
  const result = await pool.request()
    .input('prefix', db.sql.NVarChar, 'iccIT-k6-booking-%')
    .input('serviceId', db.sql.Int, serviceId)
    .input('date', db.sql.Date, date)
    .input('time', db.sql.NVarChar, `${time}:00`)
    .query(`
      SELECT b.status, COUNT(*) AS count
      FROM bookings b JOIN users u ON u.id=b.user_id
      WHERE u.email LIKE @prefix AND b.service_id=@serviceId
        AND b.booking_date=@date AND b.booking_time=@time
      GROUP BY b.status
    `);
  const rows = Object.fromEntries(result.recordset.map((row) => [String(row.status), Number(row.count)]));
  const total = Object.values(rows).reduce((sum, value) => sum + value, 0);
  const artifact = {
    generatedAt: new Date().toISOString(),
    database: db.config.database,
    runId,
    workload,
    query: { serviceId, date, time },
    statusCounts: rows,
    totalBookings: total,
    capacity: 3,
    capacityViolation: total > 3
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8');
  console.log(JSON.stringify(artifact));
  await db.close();
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
