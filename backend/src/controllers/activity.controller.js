const { query } = require('../config/db');
const { logActivity, actionLabel } = require('../lib/activity');
const { ROLES, roleLabel } = require('../constants/roles');
const { APP_TIME_ZONE_LABEL, istStamp, ONLINE_MONTHS, resolveWindow, WINDOW_DAYS } = require('../lib/time');

const READ_ROLES = [ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM];
const EXPORT_LIMIT = 5000;
const PAGE_SIZE = 20;
const PAGE_CAP = 50;

const MODULES = ['Inventory', 'Vendor', 'Assignment', 'Maintenance', 'Employee', 'Tickets', 'Reports', 'Auth'];

const ACTION_FILTERS = {
  Create: ['Create', 'ASSET_CREATE'],
  Update: ['Update', 'ASSET_UPDATE', 'Send to team'],
  Assign: ['Assign'],
  Unassign: ['Return', 'Unassign'],
  Acknowledge: ['Acknowledge'],
  Transfer: ['Transfer'],
  Replace: ['Replace'],
  Allocate: ['Allocate'],
  Close: ['Close'],
  Cancel: ['Cancel'],
  Deactivate: ['Deactivate'],
  Import: ['Import', 'ASSET_IMPORT'],
  Export: ['Export', 'ASSET_EXPORT'],
  'Status change': ['Pre-check', 'Repair complete', 'Status change', 'Repair', 'Final check'],
  'Pre-check': ['Pre-check'],
  Repair: ['Repair', 'Repair complete'],
  'Final check': ['Final check'],
  Approve: ['Approve'],
  Reject: ['Reject'],
  Login: ['Login'],
  Logout: ['Logout'],
};

function canRead(user) {
  return user && READ_ROLES.includes(user.role);
}

function ownOnly(user) {
  return user?.role === ROLES.ASSET_TEAM;
}

function pageLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return PAGE_SIZE;
  }
  return Math.min(PAGE_CAP, Math.floor(n));
}

function pageNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.floor(n);
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseCursor(value) {
  const raw = String(value || '').trim();
  const split = raw.indexOf('|');
  if (split < 1) {
    return null;
  }
  const at = new Date(raw.slice(0, split));
  const id = raw.slice(split + 1).trim();
  if (Number.isNaN(at.getTime()) || !id) {
    return null;
  }
  return { at, id };
}

function encodeCursor(row) {
  if (!row?.id || !row.at) {
    return null;
  }
  const iso = row.at instanceof Date ? row.at.toISOString() : new Date(row.at).toISOString();
  return `${iso}|${row.id}`;
}

function entityTypeLabel(type) {
  if (!type) {
    return '';
  }
  const raw = String(type);
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function entityCode(row) {
  return row.asset_code || row.employee_code || row.ticket_code || row.vendor_code || null;
}

function entityPath(row) {
  const code = entityCode(row);
  if (!code) {
    return null;
  }
  const type = String(row.entity_type || '').toLowerCase();
  if (type === 'asset') {
    return `/inventory/${code}`;
  }
  if (type === 'employee') {
    return `/employees/${code}`;
  }
  if (type === 'ticket') {
    return `/tickets/${code}`;
  }
  if (type === 'vendor') {
    return `/vendors/${code}`;
  }
  return null;
}

function toPublic(row) {
  const type = entityTypeLabel(row.entity_type);
  const code = entityCode(row);
  return {
    id: row.id,
    at: row.created_at,
    userName: row.user_name || row.user_email || 'System',
    role: row.role,
    roleLabel: roleLabel(row.role),
    module: row.module,
    action: row.action,
    actionLabel: actionLabel(row.action),
    description: row.description || '',
    entityType: type || null,
    entityCode: code,
    entityLabel: code ? `${type} ${code}` : type || '—',
    entityPath: entityPath(row),
    ip: row.ip || null,
  };
}

function buildFilters(queryIn, user) {
  const params = [];
  const where = [];
  const { from, to, spanCapped, outsideRetention } = resolveWindow(queryIn);

  params.push(from.toISOString());
  where.push(`l.created_at >= $${params.length}`);
  params.push(to.toISOString());
  where.push(`l.created_at <= $${params.length}`);

  if (ownOnly(user)) {
    params.push(user.id);
    where.push(`l.user_id = $${params.length}`);
  }

  const module = String(queryIn.module || '').trim();
  if (module && MODULES.includes(module)) {
    params.push(module);
    where.push(`l.module = $${params.length}`);
  }

  const action = String(queryIn.action || '').trim();
  const aliases = ACTION_FILTERS[action];
  if (aliases) {
    params.push(aliases);
    where.push(`l.action = ANY($${params.length}::text[])`);
  } else if (action) {
    params.push(action);
    where.push(`l.action = $${params.length}`);
  }

  const countSql = `WHERE ${where.join(' AND ')}`;
  const countParams = [...params];

  const cursor = parseCursor(queryIn.before);
  if (cursor) {
    params.push(cursor.at.toISOString());
    params.push(cursor.id);
    where.push(`(l.created_at, l.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
  }

  return {
    whereSql: `WHERE ${where.join(' AND ')}`,
    params,
    countSql,
    countParams,
    from,
    to,
    spanCapped,
    outsideRetention,
    cursor,
  };
}

const FROM = `
  FROM activity_log l
  LEFT JOIN users u ON u.id = l.user_id
  LEFT JOIN assets a ON lower(l.entity_type) = 'asset' AND a.id = l.entity_id
  LEFT JOIN employees e ON lower(l.entity_type) = 'employee' AND e.id = l.entity_id
  LEFT JOIN tickets t ON lower(l.entity_type) = 'ticket' AND t.id = l.entity_id
  LEFT JOIN vendors v ON lower(l.entity_type) = 'vendor' AND v.id = l.entity_id
`;

const COLUMNS = `
  l.id, l.created_at, l.role, l.module, l.action, l.description,
  l.entity_type, l.entity_id, l.ip,
  u.name AS user_name, u.email AS user_email,
  a.asset_code, e.employee_code, t.ticket_code, v.vendor_code
`;

async function list(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const page = pageNumber(req.query.page);
  const limit = pageLimit(req.query.limit);
  const { whereSql, params, countSql, countParams, from, to, spanCapped, outsideRetention, cursor } =
    buildFilters(req.query, req.user);
  const offset = cursor ? 0 : (page - 1) * limit;

  const count = await query(`SELECT count(*)::int AS total FROM activity_log l ${countSql}`, countParams);
  const total = count.rows[0]?.total || 0;
  const result = await query(
    `SELECT ${COLUMNS} ${FROM} ${whereSql}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  const events = result.rows.map(toPublic);
  res.json({
    ok: true,
    events,
    total,
    page: cursor ? 1 : page,
    pages: Math.max(1, Math.ceil(total / limit)),
    nextCursor: events.length === limit ? encodeCursor(events[events.length - 1]) : null,
    windowDays: WINDOW_DAYS,
    onlineMonths: ONLINE_MONTHS,
    spanCapped,
    outsideRetention,
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

async function summary(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const { countSql, countParams, from, to } = buildFilters(req.query, req.user);
  const result = await query(
    `SELECT l.module, l.action, count(*)::int AS n
     FROM activity_log l
     ${countSql}
     GROUP BY l.module, l.action
     ORDER BY l.module, l.action`,
    countParams,
  );

  res.json({
    ok: true,
    modules: MODULES,
    actions: Object.keys(ACTION_FILTERS),
    counts: result.rows,
    windowDays: WINDOW_DAYS,
    onlineMonths: ONLINE_MONTHS,
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

async function exportCsv(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const { whereSql, params } = buildFilters({ ...req.query, before: undefined }, req.user);
  const result = await query(
    `SELECT ${COLUMNS} ${FROM} ${whereSql}
     ORDER BY l.created_at DESC, l.id DESC
     LIMIT ${EXPORT_LIMIT + 1}`,
    params,
  );
  // One past the cap, so a full 5,000-row result can be told apart from one
  // that was cut short and handed over as if it were complete.
  const truncated = result.rows.length > EXPORT_LIMIT;
  const rows = result.rows.slice(0, EXPORT_LIMIT).map(toPublic);
  const headers = [`Date & Time (${APP_TIME_ZONE_LABEL})`, 'User', 'Role', 'Module', 'Activity', 'Description', 'Entity', 'IP'];
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) =>
      [
        row.at ? istStamp(row.at) : '',
        row.userName,
        row.roleLabel || row.role || '',
        row.module,
        row.actionLabel,
        row.description,
        row.entityLabel,
        row.ip || '',
      ]
        .map(csvCell)
        .join(','),
    ),
  ];

  await logActivity({
    user: req.user,
    module: 'Reports',
    action: 'Export',
    description: `Exported ${rows.length} activity log rows${truncated ? `, capped at ${EXPORT_LIMIT}` : ''}`,
    entityType: 'Activity',
    ip: req.ip,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="activity_log.csv"');
  res.setHeader('X-Export-Limit', String(EXPORT_LIMIT));
  res.setHeader('X-Export-Truncated', truncated ? 'true' : 'false');
  res.send(`\uFEFF${lines.join('\n')}\n`);
}

module.exports = { list, summary, exportCsv };
