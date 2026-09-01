const crypto = require('crypto');
const { query } = require('../config/db');

const ACTION_LABELS = {
  ASSET_CREATE: 'Create',
  ASSET_UPDATE: 'Update',
  ASSET_IMPORT: 'Import',
  ASSET_EXPORT: 'Export',
  Return: 'Unassign',
  'Repair complete': 'Repair',
  'Send to team': 'Update',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action || '—';
}

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

async function listEntityHistory(entityType, entityId, { limit = 100 } = {}) {
  const cap = Math.min(200, Math.max(1, Number(limit) || 100));
  const result = await query(
    `SELECT l.id, l.module, l.action, l.description, l.role, l.created_at,
            u.name AS user_name, u.email AS user_email
     FROM activity_log l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE lower(l.entity_type) = lower($1) AND l.entity_id = $2
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT $3`,
    [entityType, entityId, cap],
  );
  return result.rows.map((row) => ({
    id: row.id,
    module: row.module,
    action: row.action,
    actionLabel: actionLabel(row.action),
    description: row.description,
    role: row.role,
    by: row.user_name || row.user_email || 'System',
    at: row.created_at,
  }));
}

module.exports = { logActivity, listEntityHistory, actionLabel };
