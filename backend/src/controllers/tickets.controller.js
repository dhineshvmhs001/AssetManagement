const crypto = require('crypto');
const path = require('path');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { logActivity } = require('../lib/activity');
const { sendMail, mailConfigured } = require('../lib/mail');
const { JWT_SECRET, APP_URL } = require('../config/env');
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
const { assetsForTicket } = require('./assignments.controller');

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

function itemsLabel(items) {
  if (!items?.length) {
    return '';
  }
  return items.map((item) => `${item.category} × ${item.quantity}`).join(', ');
}

function normalizeItems(row) {
  if (Array.isArray(row.items) && row.items.length) {
    return row.items.map((item) => ({
      category: item.category,
      quantity: Number(item.quantity) || 1,
    }));
  }
  if (row.category) {
    return [{ category: row.category, quantity: row.quantity == null ? 1 : Number(row.quantity) }];
  }
  return [];
}

function parseItems(body) {
  let raw = body?.items;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw badRequest('Requested items are not valid');
    }
  }
  if (!Array.isArray(raw) || !raw.length) {
    const category = emptyToNull(body?.category);
    if (!category) {
      throw badRequest('Add at least one asset');
    }
    raw = [{ category, quantity: body?.quantity || 1 }];
  }

  const merged = new Map();
  for (const row of raw) {
    const category = String(row?.category || '').trim();
    if (!category) {
      continue;
    }
    if (!CATEGORIES.includes(category)) {
      throw badRequest(`Category must be ${CATEGORIES.join(', ')}`);
    }
    const n = Number(row.quantity);
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      throw badRequest('Quantity must be between 1 and 99');
    }
    merged.set(category, (merged.get(category) || 0) + n);
  }
  const items = [...merged.entries()].map(([category, quantity]) => ({ category, quantity }));
  if (!items.length) {
    throw badRequest('Add at least one asset');
  }
  return items;
}

async function saveTicketItems(ticketId, items) {
  for (const item of items) {
    await query(
      `INSERT INTO ticket_items (id, ticket_id, category, quantity)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), ticketId, item.category, item.quantity],
    );
  }
}

async function itemsByTicketIds(ids) {
  if (!ids.length) {
    return {};
  }
  const result = await query(
    `SELECT ticket_id, category, quantity
     FROM ticket_items
     WHERE ticket_id = ANY($1::uuid[])
     ORDER BY created_at`,
    [ids],
  );
  const map = {};
  for (const row of result.rows) {
    if (!map[row.ticket_id]) {
      map[row.ticket_id] = [];
    }
    map[row.ticket_id].push({
      category: row.category,
      quantity: Number(row.quantity) || 1,
    });
  }
  return map;
}

function canDecide(user, row) {
  return Boolean(
    user &&
    row &&
    user.role === ROLES.MANAGER &&
    row.manager_id &&
    row.manager_id === user.id &&
    row.status === 'AWAITING_MANAGER',
  );
}

function canDispatch(user, row) {
  return Boolean(
    user &&
    row &&
    row.status === 'WITH_ASSET_MANAGER' &&
    [ROLES.ADMIN, ROLES.ASSET_MANAGER].includes(user.role),
  );
}

function canAssignStock(user, row) {
  return Boolean(
    user &&
    row &&
    row.status === 'WITH_ASSET_TEAM' &&
    [ROLES.ADMIN, ROLES.ASSET_TEAM].includes(user.role),
  );
}

function toPublic(row, user) {
  if (!row) {
    return null;
  }
  const items = normalizeItems(row);
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    employeeId: row.employee_id,
    employeeCode: row.employee_code || null,
    employeeName: row.employee_name || null,
    department: row.employee_department || null,
    joiningDate: asDate(row.employee_joining_date),
    managerId: row.manager_id || null,
    managerName: row.manager_name || null,
    managerEmail: row.manager_email || null,
    items,
    itemsLabel: itemsLabel(items),
    category: items[0]?.category || row.category,
    quantity: total || (row.quantity == null ? 1 : Number(row.quantity)),
    priority: row.priority,
    priorityLabel: priorityLabel(row.priority),
    needDate: asDate(row.need_date),
    remarks: row.remarks,
    status: row.status,
    statusLabel: STATUSES[row.status] || row.status,
    canDecide: canDecide(user, row),
    canDispatch: canDispatch(user, row),
    canAssignStock: canAssignStock(user, row),
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
         m.email AS manager_email,
         e.manager_id
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

  if (req.user.role === ROLES.MANAGER) {
    params.push(req.user.id);
    where.push(`e.manager_id = $${params.length}`);
  }

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
  const itemMap = await itemsByTicketIds(result.rows.map((row) => row.id));
  res.json({
    ok: true,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    tickets: result.rows.map((row) => toPublic({ ...row, items: itemMap[row.id] }, req.user)),
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
    const items = parseItems(req.body);
    const fields = validate(
      pickFields({
        ...req.body,
        category: items[0].category,
        quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      }),
    );
    if (!fields.priority) {
      fields.priority = 'MEDIUM';
    }
    saved = saveTicketUploads(id, req.files || {});
    assertRequired(fields, saved);
    await assertEmployee(fields.employeeId);
    const row = await insertWithCode(id, fields, JSON.stringify(saved.attachments), req.user);
    await saveTicketItems(row.id, items);
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
    const mail = await notifyManager(fresh);
    return res.status(201).json({ ok: true, ticket: toPublic(fresh, req.user), mail });
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
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const map = await itemsByTicketIds([row.id]);
  row.items = map[row.id] || [];
  return row;
}

async function getOne(req, res) {
  if (!canRead(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Ticket not found' });
  }
  if (req.user.role === ROLES.MANAGER && row.manager_id !== req.user.id) {
    return res.status(404).json({ ok: false, error: 'Ticket not found' });
  }
  const allocatedAssets = await assetsForTicket(row.id);
  res.json({ ok: true, ticket: { ...toPublic(row, req.user), allocatedAssets } });
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
  if (req.user.role === ROLES.MANAGER && row.manager_id !== req.user.id) {
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

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decisionToken(ticketId, action) {
  return jwt.sign({ tid: ticketId, act: action }, JWT_SECRET, { expiresIn: '14d' });
}

function readDecisionToken(token) {
  const payload = jwt.verify(String(token || ''), JWT_SECRET);
  if (!payload?.tid || !['approve', 'reject'].includes(payload.act)) {
    const err = new Error('This approval link is not valid');
    err.statusCode = 400;
    throw err;
  }
  return payload;
}

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f5; color: #18181b; margin: 0; padding: 32px 16px; }
    .card { max-width: 32rem; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; }
    h1 { font-size: 1.25rem; margin: 0 0 12px; }
    p { line-height: 1.5; }
    button, .btn { display: inline-block; margin-top: 12px; padding: 10px 16px; border: 0; border-radius: 8px;
      background: #7c3aed; color: #fff; font-weight: 700; cursor: pointer; text-decoration: none; }
    .reject { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">${body}</div>
</body>
</html>`;
}

async function notifyManager(row) {
  const to = emptyToNull(row.manager_email);
  if (!to) {
    return { sent: false, error: 'Employee has no manager email' };
  }
  if (!mailConfigured()) {
    return { sent: false, error: 'SMTP is not configured' };
  }

  const approveUrl = `${APP_URL}/api/tickets/decide?token=${encodeURIComponent(decisionToken(row.id, 'approve'))}`;
  const rejectUrl = `${APP_URL}/api/tickets/decide?token=${encodeURIComponent(decisionToken(row.id, 'reject'))}`;
  const need = itemsLabel(normalizeItems(row)) || `${row.category || '-'} × ${row.quantity || 1}`;
  const code = row.ticket_code;
  const who = row.employee_name || row.employee_code || 'an employee';

  try {
    await sendMail({
      to,
      subject: `Approve asset request ${code}`,
      text: [
        `Please approve or reject ticket ${code} for ${who}.`,
        `Requested: ${need}`,
        `Priority: ${priorityLabel(row.priority)}`,
        `Need date: ${asDate(row.need_date) || '-'}`,
        `Remarks: ${row.remarks || '-'}`,
        `Approve: ${approveUrl}`,
        `Reject: ${rejectUrl}`,
      ].join('\n'),
      html: `
        <p>Please approve or reject asset request <b>${esc(code)}</b> for <b>${esc(who)}</b>.</p>
        <p>
          Requested: ${esc(need)}<br/>
          Priority: ${esc(priorityLabel(row.priority))}<br/>
          Need date: ${esc(asDate(row.need_date) || '-')}<br/>
          Remarks: ${esc(row.remarks || '-')}
        </p>
        <p>
          <a href="${esc(approveUrl)}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;margin-right:8px">Approve</a>
          <a href="${esc(rejectUrl)}" style="display:inline-block;padding:10px 16px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:8px">Reject</a>
        </p>
        <p style="color:#71717a;font-size:13px">These links expire in 14 days. Clicking opens a confirm page; Gmail preview will not change the ticket.</p>
      `,
    });
    return { sent: true, to };
  } catch (err) {
    console.error('Manager approval mail failed:', err);
    return { sent: false, error: err.message || 'Could not send mail' };
  }
}

async function applyDecision(ticketId, action) {
  const next = action === 'approve' ? 'WITH_ASSET_MANAGER' : 'REJECTED';
  const result = await query(
    `UPDATE tickets SET status = $2
     WHERE id = $1 AND status = 'AWAITING_MANAGER'
     RETURNING *`,
    [ticketId, next],
  );
  return result.rows[0] || null;
}

function decideForm(req, res) {
  try {
    const payload = readDecisionToken(req.query.token);
    return findByCode(payload.tid).then((row) => {
      if (!row) {
        res.status(404).send(htmlPage('Ticket not found', '<h1>Ticket not found</h1>'));
        return;
      }
      if (row.status !== 'AWAITING_MANAGER') {
        res.send(htmlPage(
          'Already decided',
          `<h1>${esc(row.ticket_code)}</h1><p>This ticket is already <b>${esc(STATUSES[row.status] || row.status)}</b>.</p>`,
        ));
        return;
      }
      const action = payload.act;
      const label = action === 'approve' ? 'Approve' : 'Reject';
      res.send(htmlPage(
        `${label} ${row.ticket_code}`,
        `<h1>${esc(label)} ${esc(row.ticket_code)}?</h1>
         <p>${esc(row.employee_name || '')} · ${esc(itemsLabel(normalizeItems(row)) || `${row.category || ''} × ${row.quantity || 1}`)}</p>
         <form method="post" action="/api/tickets/decide">
           <input type="hidden" name="token" value="${esc(req.query.token)}" />
           <button type="submit" class="${action === 'reject' ? 'reject' : ''}">${esc(label)} this ticket</button>
         </form>`,
      ));
    });
  } catch {
    res.status(400).send(htmlPage('Invalid link', '<h1>This approval link is invalid or expired.</h1>'));
  }
}

async function decideSubmit(req, res) {
  try {
    const payload = readDecisionToken(req.body?.token || req.query.token);
    const updated = await applyDecision(payload.tid, payload.act);
    const row = updated || (await findByCode(payload.tid));
    if (!row) {
      res.status(404).send(htmlPage('Ticket not found', '<h1>Ticket not found</h1>'));
      return;
    }
    if (updated) {
      await logActivity({
        user: { email: row.manager_email, id: null },
        module: 'Tickets',
        action: payload.act === 'approve' ? 'Approve' : 'Reject',
        description: `${payload.act === 'approve' ? 'Approved' : 'Rejected'} ticket ${row.ticket_code}`,
        entityType: 'Ticket',
        entityId: row.id,
        ip: req.ip,
      });
    }
    const label = STATUSES[row.status] || row.status;
    res.send(htmlPage(
      row.ticket_code,
      `<h1>${esc(row.ticket_code)}</h1><p>Status is now <b>${esc(label)}</b>.</p>`,
    ));
  } catch {
    res.status(400).send(htmlPage('Invalid link', '<h1>This approval link is invalid or expired.</h1>'));
  }
}

async function decideInApp(req, res) {
  const action = String(req.body?.action || '').toLowerCase();
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ ok: false, error: 'Choose approve or reject' });
  }
  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Ticket not found' });
  }
  if (!canDecide(req.user, row)) {
    return res.status(403).json({ ok: false, error: 'Only this employee’s manager can decide while the ticket is waiting' });
  }
  const updated = await applyDecision(row.id, action);
  if (!updated) {
    return res.status(409).json({ ok: false, error: 'This ticket was already decided' });
  }
  await logActivity({
    user: req.user,
    module: 'Tickets',
    action: action === 'approve' ? 'Approve' : 'Reject',
    description: `${action === 'approve' ? 'Approved' : 'Rejected'} ticket ${row.ticket_code}`,
    entityType: 'Ticket',
    entityId: row.id,
    ip: req.ip,
  });
  const fresh = await findByCode(row.ticket_code);
  const allocatedAssets = await assetsForTicket(fresh.id);
  return res.json({ ok: true, ticket: { ...toPublic(fresh, req.user), allocatedAssets } });
}

async function dispatchToTeam(req, res) {
  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Ticket not found' });
  }
  if (!canDispatch(req.user, row)) {
    return res.status(403).json({ ok: false, error: 'Asset Manager sends this ticket to Asset Team first' });
  }
  const updated = await query(
    `UPDATE tickets SET status = 'WITH_ASSET_TEAM'
     WHERE id = $1 AND status = 'WITH_ASSET_MANAGER'
     RETURNING *`,
    [row.id],
  );
  if (!updated.rows[0]) {
    return res.status(409).json({ ok: false, error: 'This ticket was already sent to Asset Team' });
  }
  await logActivity({
    user: req.user,
    module: 'Tickets',
    action: 'Send to team',
    description: `Sent ${row.ticket_code} to Asset Team`,
    entityType: 'Ticket',
    entityId: row.id,
    ip: req.ip,
  });
  const fresh = await findByCode(row.ticket_code);
  const allocatedAssets = await assetsForTicket(fresh.id);
  return res.json({ ok: true, ticket: { ...toPublic(fresh, req.user), allocatedAssets } });
}

module.exports = { list, create, getOne, file, options, decideForm, decideSubmit, decideInApp, dispatchToTeam };
