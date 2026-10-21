const db = require('../db');
const localLockTails = new Map();

async function acquireLocalLock(lockName) {
  const previous = localLockTails.get(lockName) || Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => { releaseCurrent = resolve; });
  localLockTails.set(lockName, current);
  await previous;
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    releaseCurrent();
    if (localLockTails.get(lockName) === current) localLockTails.delete(lockName);
  };
}

async function acquireMysqlNamedLock(name, timeoutSeconds = 10) {
  const lockName = String(name || '').slice(0, 64);
  if (!lockName) throw new Error('MYSQL_LOCK_NAME_REQUIRED');
  const releaseLocalLock = await acquireLocalLock(lockName);
  let connection;
  try {
    connection = await db.acquireConnection();
    const [rows] = await connection.query(
      'SELECT GET_LOCK(?, ?) AS acquired',
      [lockName, Number(timeoutSeconds)]
    );
    if (Number(rows?.[0]?.acquired) !== 1) {
      const error = new Error('MYSQL_LOCK_TIMEOUT');
      error.status = 503;
      throw error;
    }
    let released = false;
    const release = async () => {
      if (released) return;
      released = true;
      await connection.query('SELECT RELEASE_LOCK(?) AS released', [lockName]).catch(() => {});
      connection.release();
      await releaseLocalLock();
    };
    release.connection = connection;
    return release;
  } catch (error) {
    if (connection) connection.release();
    await releaseLocalLock();
    throw error;
  }
}

async function withMysqlNamedLock(pool, name, fn, timeoutSeconds = 10) {
  const lockName = String(name || '').slice(0, 64);
  if (!lockName) throw new Error('MYSQL_LOCK_NAME_REQUIRED');

  // GET_LOCK is connection-scoped. Keep the lock and release on one raw
  // connection while the callback uses the normal compatibility pool.
  if (typeof db.acquireConnection === 'function') {
    const release = await acquireMysqlNamedLock(lockName, timeoutSeconds);
    try {
      return await fn(release.connection);
    } finally {
      await release();
    }
  }

  // Fallback for lightweight unit-test doubles without a raw connection.
  const acquired = await pool.request()
    .input('lock_name', db.sql.NVarChar, lockName)
    .input('timeout_seconds', db.sql.Int, Number(timeoutSeconds))
    .query('SELECT GET_LOCK(@lock_name, @timeout_seconds) AS acquired');
  if (Number(acquired.recordset?.[0]?.acquired) !== 1) {
    const error = new Error('MYSQL_LOCK_TIMEOUT');
    error.status = 503;
    throw error;
  }
  try {
    return await fn();
  } finally {
    await pool.request()
      .input('lock_name', db.sql.NVarChar, lockName)
      .query('SELECT RELEASE_LOCK(@lock_name) AS released')
      .catch(() => {});
  }
}

module.exports = { acquireMysqlNamedLock, withMysqlNamedLock };
