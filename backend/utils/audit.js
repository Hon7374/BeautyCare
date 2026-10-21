const db = require('../db');

/**
 * Simple audit logger.
 * - Safe for demo: if the audit_logs table is missing, it will not block requests.
 */
async function audit({ actorUserId, action, entity, entityId, meta, ip }) {
  try {
    const pool = await db.connect();
    await pool
      .request()
      .input('actor', db.sql.Int, actorUserId ? Number(actorUserId) : null)
      .input('action', db.sql.NVarChar, String(action || '').slice(0, 50))
      .input('entity', db.sql.NVarChar, String(entity || '').slice(0, 50))
      .input('entity_id', db.sql.NVarChar, entityId !== undefined && entityId !== null ? String(entityId).slice(0, 50) : null)
      .input('meta', db.sql.NVarChar(db.sql.MAX), meta ? JSON.stringify(meta).slice(0, 4000) : null)
      .input('ip', db.sql.NVarChar, ip ? String(ip).slice(0, 45) : null)
      .query(
        `
        INSERT INTO audit_logs (actor_user_id, action, entity, entity_id, meta, ip)
        VALUES (@actor, @action, @entity, @entity_id, @meta, @ip)
        `
      );
  } catch (e) {
    // Do not break business flow in demo.
    console.warn('⚠️ audit log write failed (table missing?)', e?.message || e);
  }
}

module.exports = { audit };
