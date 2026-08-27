const crypto = require('crypto');
const { query } = require('../config/db');

async function logActivity({ user, module, action, description, entityType, entityId, ip }) {
  try {
    await query(
      `INSERT INTO activity_log (
         id, user_id, role, module, action, description, entity_type, entity_id, ip
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        crypto.randomUUID(),
        user?.id || null,
        user?.role || null,
        module,
        action,
        description || null,
        entityType || null,
        entityId || null,
        ip || null,
      ],
    );
  } catch (err) {
    console.error('activity_log write failed:', err.message);
  }
}

module.exports = { logActivity };
