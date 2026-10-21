const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const databaseName = String(process.env.DB_TEST_NAME || 'beautycare_test').trim();
if (!/^[A-Za-z0-9_]+$/.test(databaseName) || databaseName === 'beautycare') {
  throw new Error('DB_TEST_NAME must be a safe name different from beautycare');
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.DATABASE_PORT || 3306),
    user: process.env.DB_USER || process.env.DATABASE_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
    charset: 'utf8mb4',
    multipleStatements: true
  });
  const schemaPath = path.resolve(__dirname, '../../database/beautycare.mysql.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8')
    .replace(/DROP DATABASE IF EXISTS beautycare\s*;/i, `DROP DATABASE IF EXISTS \`${databaseName}\`;`)
    .replace(/CREATE DATABASE beautycare\s/ig, `CREATE DATABASE \`${databaseName}\` `)
    .replace(/USE beautycare\s*;/i, `USE \`${databaseName}\`;`);
  await connection.query(schema);
  await connection.end();
  console.log(`[schema] Initialized isolated test database: ${databaseName}`);
}

main().catch((error) => {
  console.error(`[schema] Test database initialization failed: ${error.message}`);
  process.exitCode = 1;
});
