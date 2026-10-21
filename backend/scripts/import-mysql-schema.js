/*
 * Imports the project schema as UTF-8.  Reading the SQL file through a shell
 * with its legacy code page can turn Vietnamese characters into question marks;
 * this script always reads the source as UTF-8 and sends it as utf8mb4.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const schemaPath = path.resolve(__dirname, '../../database/beautycare.mysql.sql');

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
    multipleStatements: true
  });

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  await connection.query(schemaSql);
  await connection.end();

  console.log(`[schema] Imported UTF-8 schema: ${schemaPath}`);
}

main().catch((error) => {
  console.error(`[schema] Import failed: ${error.message}`);
  process.exitCode = 1;
});
