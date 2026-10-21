require('dotenv').config();
const mysql = require('mysql2/promise');
const runtime = require('./utils/runtime');
const DB_ENGINE = 'mysql';

const performanceMode = typeof runtime.performanceTestMode === 'function' && runtime.performanceTestMode();
const configuredPoolSize = Number(process.env.DB_POOL_SIZE || 10) || 10;
const configuredPerformancePoolSize = Number(process.env.PERF_TEST_DB_POOL_SIZE || 25) || 25;
const poolSize = performanceMode
  ? Math.min(50, Math.max(10, configuredPerformancePoolSize))
  : Math.max(1, configuredPoolSize);

const sql = {
  Int: { type: 'int' },
  Bit: { type: 'bit' },
  Date: { type: 'date' },
  DateTime: { type: 'datetime' },
  MAX: 'max',
  NVarChar(length) {
    return { type: 'nvarchar', length };
  },
  VarChar(length) {
    return { type: 'varchar', length };
  },
  Decimal(precision, scale) {
    return { type: 'decimal', precision, scale };
  }
};

const config = {
  host: process.env.DB_HOST || process.env.DATABASE_HOST || process.env.DB_SERVER || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.DATABASE_PORT || 3306),
  user: process.env.DB_USER || process.env.DATABASE_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
  database: process.env.DB_NAME || process.env.DATABASE_NAME || 'beautycare',
  waitForConnections: true,
  connectionLimit: poolSize,
  // Keep a bounded queue so overload is observable instead of growing memory
  // without limit. This does not change production defaults.
  queueLimit: performanceMode ? 1000 : 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  supportBigNumbers: true,
  decimalNumbers: true
};

let rawPool;
let compatPool;

function stripTrailingSemicolon(text) {
  return String(text || '').trim().replace(/;+\s*$/, '');
}

function applyTopLimit(sqlText) {
  let limit = null;
  let text = String(sqlText || '');

  text = text.replace(/SELECT\s+TOP\s*\(\s*(\d+)\s*\)\s+/i, (_, value) => {
    limit = Number(value);
    return 'SELECT ';
  });

  if (!limit) {
    text = text.replace(/SELECT\s+TOP\s+(\d+)\s+/i, (_, value) => {
      limit = Number(value);
      return 'SELECT ';
    });
  }

  if (!limit) return stripTrailingSemicolon(text);

  const trimmed = stripTrailingSemicolon(text);
  if (/\bLIMIT\s+\d+\b/i.test(trimmed)) return trimmed;
  return `${trimmed} LIMIT ${limit}`;
}

function translateSql(sqlText) {
  let text = String(sqlText || '').replace(/\r\n/g, '\n');

  text = text.replace(/\[([A-Za-z_][A-Za-z0-9_]*)\]/g, '`$1`');
  text = text.replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP');
  text = text.replace(/ISNULL\s*\(/gi, 'IFNULL(');
  text = text.replace(/CAST\(\s*@([A-Za-z_][A-Za-z0-9_]*)\s+AS\s+date\s*\)/gi, 'DATE(@$1)');
  text = text.replace(/CAST\(\s*@([A-Za-z_][A-Za-z0-9_]*)\s+AS\s+time\s*\(\s*0\s*\)\s*\)/gi, 'TIME(@$1)');
  text = text.replace(
    /DATEADD\s*\(\s*day\s*,\s*(-?)\s*@([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_.]*|CURRENT_TIMESTAMP|NOW\(\))\s*\)/gi,
    (_, negative, paramName, expr) => `TIMESTAMPADD(DAY, ${negative ? '0 - ' : ''}@${paramName}, ${expr})`
  );

  return applyTopLimit(text);
}

function bindParams(sqlText, params) {
  const values = [];
  const text = String(sqlText || '').replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    if (!params.has(name)) {
      throw new Error(`Missing SQL parameter @${name}`);
    }
    values.push(params.get(name));
    return '?';
  });

  return { sqlText: text, values };
}

async function runStatement(pool, sqlText, params) {
  const translated = translateSql(sqlText);
  const bound = bindParams(translated, params);
  const [rows] = await pool.query(bound.sqlText, bound.values);

  if (Array.isArray(rows)) {
    return {
      recordset: rows,
      rowsAffected: [rows.length],
      insertId: 0
    };
  }

  return {
    recordset: [],
    rowsAffected: [Number(rows.affectedRows || 0)],
    insertId: Number(rows.insertId || 0)
  };
}

function parseInsertOutput(sqlText) {
  const match = String(sqlText || '').match(
    /^\s*INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]+?)\)\s*OUTPUT\s+INSERTED\.(\*|[A-Za-z_][A-Za-z0-9_]*)\s*VALUES\s*\(([\s\S]+?)\)\s*;?\s*$/i
  );

  if (!match) return null;

  return {
    table: match[1],
    returning: match[3],
    rewritten: `INSERT INTO ${match[1]} (${match[2]}) VALUES (${match[4]})`
  };
}

async function executeQuery(pool, sqlText, params) {
  const insertOutput = parseInsertOutput(sqlText);
  if (insertOutput) {
    const inserted = await runStatement(pool, insertOutput.rewritten, params);
    const insertedId = Number(inserted.insertId || 0);

    if (!insertedId) {
      return { recordset: [], rowsAffected: inserted.rowsAffected, insertId: insertedId };
    }

    if (insertOutput.returning === 'id') {
      return { recordset: [{ id: insertedId }], rowsAffected: inserted.rowsAffected, insertId: insertedId };
    }

    const columnList = insertOutput.returning === '*' ? '*' : `\`${insertOutput.returning}\``;
    const selected = await runStatement(
      pool,
      `SELECT ${columnList} FROM ${insertOutput.table} WHERE id=@id LIMIT 1`,
      new Map([['id', insertedId]])
    );

    return {
      recordset: selected.recordset,
      rowsAffected: inserted.rowsAffected,
      insertId: insertedId
    };
  }

  return runStatement(pool, sqlText, params);
}

class CompatRequest {
  constructor(pool) {
    this.pool = pool;
    this.params = new Map();
  }

  input(name, type, value) {
    if (arguments.length === 2) {
      value = type;
    }

    this.params.set(String(name), value);
    return this;
  }

  async query(sqlText) {
    return executeQuery(this.pool, sqlText, this.params);
  }
}

function createCompatPool(pool) {
  return {
    request() {
      return new CompatRequest(pool);
    },
    async query(sqlText, values) {
      const [rows] = await pool.query(sqlText, values);
      return rows;
    }
  };
}

async function connect() {
  if (compatPool) {
    return compatPool;
  }

  if (!rawPool) {
    rawPool = mysql.createPool(config);
  }

  try {
    await rawPool.query('SELECT 1');
    compatPool = createCompatPool(rawPool);
    console.log(`MySQL connected (${config.host}:${config.port}/${config.database})`);
  } catch (error) {
    await rawPool.end().catch(() => {});
    rawPool = null;
    compatPool = null;
    throw error;
  }
  return compatPool;
}

async function close() {
  if (!rawPool) return;
  await rawPool.end();
  rawPool = null;
  compatPool = null;
}

async function acquireConnection() {
  if (!rawPool) await connect();
  return rawPool.getConnection();
}

async function withTransaction(callback) {
  if (typeof callback !== 'function') throw new TypeError('DB_TRANSACTION_CALLBACK_REQUIRED');
  const connection = await acquireConnection();
  try {
    return await withConnectionTransaction(connection, callback);
  } finally {
    connection.release();
  }
}

// Run a transaction on a caller-owned connection. This avoids a pool
// deadlock when the same connection already holds a MySQL named lock.
async function withConnectionTransaction(connection, callback) {
  if (!connection || typeof connection.beginTransaction !== 'function') throw new TypeError('DB_CONNECTION_REQUIRED');
  if (typeof callback !== 'function') throw new TypeError('DB_TRANSACTION_CALLBACK_REQUIRED');
  const transactionPool = createCompatPool(connection);
  try {
    await connection.beginTransaction();
    const result = await callback(transactionPool);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  }
}

module.exports = { sql, config, connect, close, acquireConnection, withTransaction, withConnectionTransaction, DB_ENGINE };
