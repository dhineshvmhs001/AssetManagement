const crypto = require('crypto');
const path = require('path');
const { query } = require('../config/db');
const { logActivity } = require('../lib/activity');
const {
  TICKET_ROOT,
  saveTicketUploads,
  removeTicketUploads,
  parseStored,
  publicTicketFiles,
} = require('../lib/uploads');
const { ROLES } = require('../constants/roles');
const {
  PRODUCTION_MODE,
  CATEGORIES,
  PRIORITIES,
  missingRequired,
  requiredFieldKeys,
} = require('../constants/ticketRequired');

const WRITE_ROLES = [ROLES.ADMIN, ROLES.HR];
const READ_ROLES = [...WRITE_ROLES, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM, ROLES.MANAGER];

const STATUSES = {
  AWAITING_MANAGER: 'Awaiting manager approval',
  WITH_ASSET_MANAGER: 'With Asset Manager',
  WITH_ASSET_TEAM: 'Assigned to Asset Team',
  CLOSED: 'Closed',
  REJECTED: 'Not approved',
};

function canWrite(user) {
  return user && WRITE_ROLES.includes(user.role);
}

function canRead(user) {
  return user && READ_ROLES.includes(user.role);
}

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function safeMessage(err, fallback) {
  if (err.statusCode && err.statusCode < 500) {
    return err.message;
  }
  console.error(`${fallback}:`, err);
  return fallback;
}

function emptyToNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

function asDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function priorityLabel(priority) {
  const map = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
  return map[priority] || priority;
}

function toPublic(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    employeeId: row.employee_id,
    employeeCode: row.employee_code || null,
    employeeName: row.employee_name || null,
    department: row.employee_department || null,
    joiningDate: asDate(row.employee_joining_date),
    managerName: row.manager_name || null,
    managerEmail: row.manager_email || null,
    category: row.category,
    quantity: row.quantity == null ? 1 : Number(row.quantity),
    priority: row.priority,
    priorityLabel: priorityLabel(row.priority),
    needDate: asDate(row.need_date),
    remarks: row.remarks,
    status: row.status,
    statusLabel: STATUSES[row.status] || row.status,
    ...publicTicketFiles(row.id, row.attachments),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function pickFields(body) {
  const out = {};
  for (const key of ['employeeId', 'category', 'quantity', 'priority', 'needDate', 'remarks']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = emptyToNull(body[key]);
    }
  }
  if (out.quantity != null) {
    out.quantity = String(out.quantity);
  }
  return out;
}

function validate(fields) {
  if (fields.category && !CATEGORIES.includes(fields.category)) {
    throw badRequest(`Category must be ${CATEGORIES.join(', ')}`);
  }
  if (fields.priority) {
    fields.priority = fields.priority.toUpperCase();
    if (!PRIORITIES.includes(fields.priority)) {
      throw badRequest('Priority must be Low, Medium, or High');
    }
  }
  if (fields.needDate && !/^\d{4}-\d{2}-\d{2}$/.test(fields.needDate)) {
    throw badRequest('Need date is not valid');
  }
  if (fields.quantity != null) {
    const n = Number(fields.quantity);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      throw badRequest('Quantity must be between 1 and 99');
    }
    fields.quantity = n;
  }
  if (fields.employeeId && !/^[0-9a-f-]{36}$/i.test(fields.employeeId)) {
    throw badRequest('Employee is not valid');
  }
  return fields;
}

function assertRequired(fields, files) {
  const missing = missingRequired(fields, files);
  if (missing.length) {
    throw badRequest(`Required: ${missing.join(', ')}`);
  }
}

async function assertEmployee(employeeId) {
  const result = await query(
    `SELECT id, status FROM employees WHERE id = $1 LIMIT 1`,
    [employeeId],
  );
  if (!result.rows[0]) {
    throw badRequest('Employee not found. Add them in Employees first.');
  }
  if (result.rows[0].status !== 'ACTIVE') {
    throw badRequest('Pick an active employee');
  }
}

async function nextTicketCode() {
  const year = new Date().getFullYear();
  const prefix = `TK-${year}-`;
  const result = await query(
    `SELECT ticket_code
     FROM tickets
     WHERE ticket_code LIKE $1
     ORDER BY CASE
       WHEN substring(ticket_code from ${prefix.length + 1}) ~ '^\\d+$'
       THEN substring(ticket_code from ${prefix.length + 1})::bigint
       ELSE 0
     END DESC
     LIMIT 1`,
    [`${prefix}%`],
  );
  let n = 1;
  if (result.rows[0]) {
    const parsed = Number(String(result.rows[0].ticket_code).slice(prefix.length));
    if (Number.isFinite(parsed)) {
      n = parsed + 1;
    }
  }
  return `${prefix}${String(n).padStart(4, '0')}`;
}

const SELECT_TICKET = `
  SELECT t.*,
         e.employee_code,
         e.name AS employee_name,
         e.department AS employee_department,
         e.joining_date AS employee_joining_date,
         m.name AS manager_name,
         m.email AS manager_email
  FROM tickets t
  LEFT JOIN employees e ON e.id = t.employee_id
  LEFT JOIN users m ON m.id = e.manager_id
`;

async function list(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = emptyToNull(req.query.search);
  const status = emptyToNull(req.query.status);
  const employee = emptyToNull(req.query.employee);
  const params = [];
  const where = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(t.ticket_code ILIKE $${params.length} OR e.name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length})`,
    );
  }
  if (status && STATUSES[status]) {
    params.push(status);
    where.push(`t.status = $${params.length}`);
  }
  if (employee) {
    params.push(employee);
    where.push(`(e.employee_code = $${params.length} OR e.id::text = $${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query(
    `SELECT COUNT(*)::int AS n
     FROM tickets t
     LEFT JOIN employees e ON e.id = t.employee_id
     ${whereSql}`,
    params,
  );
  const pageParams = [...params, limit, offset];
  const result = await query(
    `${SELECT_TICKET}
     ${whereSql}
     ORDER BY t.created_at DESC
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );

  const total = count.rows[0].n;
  res.json({
    ok: true,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    tickets: result.rows.map(toPublic),
    filters: { statuses: Object.keys(STATUSES), categories: CATEGORIES, priorities: PRIORITIES },
  });
}

async function insertWithCode(id, fields, attachmentsJson, actor) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ticketCode = await nextTicketCode();
    try {
      const result = await query(
        `INSERT INTO tickets (
           id, ticket_code, employee_id, category, quantity, priority, need_date,
           remarks, attachments, status, created_by, created_by_user_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [
          id,
          ticketCode,
          fields.employeeId,
          fields.category,
          fields.quantity || 1,
          fields.priority || 'MEDIUM',
          fields.needDate,
          fields.remarks,
          attachmentsJson,
          'AWAITING_MANAGER',
          actor?.email || null,
          actor?.id || null,
        ],
      );
      return result.rows[0];
    } catch (err) {
      if (err.code !== '23505' || !String(err.constraint || err.detail || '').includes('ticket_code')) {
        throw err;
      }
    }
  }
  throw badRequest('Could not allocate a ticket ID. Please try again.');
}

async function create(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const id = crypto.randomUUID();
  let saved = { attachments: [] };
  try {
    const fields = validate(pickFields(req.body));
    if (!fields.priority) {
      fields.priority = 'MEDIUM';
    }
    if (fields.quantity == null) {
      fields.quantity = 1;
    }
    saved = saveTicketUploads(id, req.files || {});
    assertRequired(fields, saved);
    await assertEmployee(fields.employeeId);
    const row = await insertWithCode(id, fields, JSON.stringify(saved.attachments), req.user);
    await logActivity({
      user: req.user,
      module: 'Tickets',
      action: 'Create',
      description: `Created ticket ${row.ticket_code}`,
      entityType: 'Ticket',
      entityId: row.id,
      ip: req.ip,
    });
    const fresh = await findByCode(row.ticket_code);
    return res.status(201).json({ ok: true, ticket: toPublic(fresh) });
  } catch (err) {
    removeTicketUploads(id);
    return res.status(err.statusCode || 500).json({ ok: false, error: safeMessage(err, 'Could not create ticket') });
  }
}

async function findByCode(code) {
  const result = await query(
    `${SELECT_TICKET}
     WHERE t.ticket_code = $1 OR t.id::text = $1
     LIMIT 1`,
    [code],
  );
  return result.rows[0] || null;
}

async function getOne(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Ticket not found' });
  }
  res.json({ ok: true, ticket: toPublic(row) });
}

async function file(req, res) {
  const stored = String(req.params.stored || '');
  const notFound = () => res.status(404).json({ ok: false, error: 'File not found' });

  if (!/^[A-Za-z0-9._-]+$/.test(stored) || stored.includes('..')) {
    return notFound();
  }

  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return notFound();
  }

  const listed = parseStored(row.attachments).find((item) => item.stored === stored);
  if (!listed) {
    return notFound();
  }

  res.type(listed.mime || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(listed.name || stored)}`,
  );
  return res.sendFile(path.join(TICKET_ROOT, row.id, 'attachments', stored), (err) => {
    if (err && !res.headersSent) {
      notFound();
    }
  });
}

function options(_req, res) {
  res.json({
    ok: true,
    productionMode: PRODUCTION_MODE,
    requiredFields: requiredFieldKeys(),
    categories: CATEGORIES,
    priorities: PRIORITIES,
    statuses: Object.entries(STATUSES).map(([value, label]) => ({ value, label })),
  });
}

module.exports = { list, create, getOne, file, options };
