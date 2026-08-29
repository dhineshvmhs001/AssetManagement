const crypto = require('crypto');
const path = require('path');
const { pool, query } = require('../config/db');
const { logActivity } = require('../lib/activity');
const { ROLES } = require('../constants/roles');
const { STATUS, CONDITIONS, statusLabel } = require('../constants/assetStatus');
const {
  ASSIGNMENT_ROOT,
  parseStored,
  publicAssignmentFiles,
  saveAssignmentUploads,
  removeAssignmentUploads,
} = require('../lib/uploads');

const WRITE_ROLES = [ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM];
const TICKET_ASSIGN_ROLES = [ROLES.ADMIN, ROLES.ASSET_TEAM];
const ASSIGNABLE_TICKETS = ['WITH_ASSET_TEAM'];
const ASSIGNMENT_TYPES = ['Permanent', 'Probation', 'Replacement'];
const RETURN_REASONS = [
  'End of assignment',
  'Employee Resignation',
  'Asset Replacement',
  'Repair/Maintenance',
  'Transfer',
  'Other',
];
const RETURN_CONDITIONS = ['Good', 'Fair', 'Damaged', 'Non-functional', 'Lost/Incomplete'];

function canWrite(user) {
  return user && WRITE_ROLES.includes(user.role);
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

function toPublic(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    assignmentCode: row.assignment_code,
    assetId: row.asset_id,
    assetCode: row.asset_code,
    category: row.category,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: row.employee_name,
    ticketId: row.ticket_id,
    ticketCode: row.ticket_code,
    assignedAt: asDate(row.assigned_at),
    expectedReturn: asDate(row.expected_return),
    assignmentType: row.assignment_type || row.purpose || null,
    condition: row.condition,
    location: row.location,
    accessories: row.accessories,
    remarks: row.remarks,
    assignedBy: row.assigned_by,
    returnedAt: asDate(row.returned_at),
    returnReason: row.return_reason,
    returnCondition: row.return_condition,
    assetStatus: row.asset_status,
    assetStatusLabel: row.asset_status ? statusLabel(row.asset_status) : null,
    ...publicAssignmentFiles(row.id, row.documents),
  };
}

const SELECT_ASSIGNMENT = `
  SELECT aa.*,
         a.asset_code, a.category, a.brand, a.model, a.serial_number, a.status AS asset_status,
         e.employee_code, e.name AS employee_name,
         t.ticket_code
  FROM asset_assignments aa
  JOIN assets a ON a.id = aa.asset_id
  JOIN employees e ON e.id = aa.employee_id
  LEFT JOIN tickets t ON t.id = aa.ticket_id
`;

async function nextAssignmentCode(client) {
  const year = new Date().getFullYear();
  const prefix = `ASN-${year}-`;
  const result = await client.query(
    `SELECT assignment_code
     FROM asset_assignments
     WHERE assignment_code LIKE $1
     ORDER BY CASE
       WHEN substring(assignment_code from ${prefix.length + 1}) ~ '^\\d+$'
       THEN substring(assignment_code from ${prefix.length + 1})::bigint
       ELSE 0
     END DESC
     LIMIT 1`,
    [`${prefix}%`],
  );
  let n = 1;
  if (result.rows[0]) {
    const parsed = Number(String(result.rows[0].assignment_code).slice(prefix.length));
    if (Number.isFinite(parsed)) {
      n = parsed + 1;
    }
  }
  return `${prefix}${String(n).padStart(5, '0')}`;
}

async function holdingsForEmployee(employeeId) {
  const result = await query(
    `${SELECT_ASSIGNMENT}
     WHERE aa.employee_id = $1 AND aa.returned_at IS NULL
     ORDER BY aa.assigned_at DESC`,
    [employeeId],
  );
  return result.rows.map(toPublic);
}

async function assetsForTicket(ticketId) {
  const result = await query(
    `SELECT a.asset_code, a.category, a.brand, a.model, a.serial_number
     FROM ticket_assets ta
     JOIN assets a ON a.id = ta.asset_id
     WHERE ta.ticket_id = $1
     ORDER BY a.asset_code`,
    [ticketId],
  );
  return result.rows.map((row) => ({
    assetCode: row.asset_code,
    category: row.category,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
  }));
}

async function options(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const employees = await query(
    `SELECT id, employee_code, name, department, location
     FROM employees
     WHERE status = 'ACTIVE'
     ORDER BY name`,
  );
  const canAssignTickets = TICKET_ASSIGN_ROLES.includes(req.user.role);
  const tickets = canAssignTickets
    ? await query(
        `SELECT t.id, t.ticket_code, t.employee_id, t.status, t.category, t.quantity,
                e.employee_code, e.name AS employee_name
         FROM tickets t
         JOIN employees e ON e.id = t.employee_id
         WHERE t.status = ANY($1::text[])
         ORDER BY t.created_at DESC
         LIMIT 100`,
        [ASSIGNABLE_TICKETS],
      )
    : { rows: [] };
  const itemMap = {};
  if (tickets.rows.length) {
    const items = await query(
      `SELECT ticket_id, category, quantity
       FROM ticket_items
       WHERE ticket_id = ANY($1::uuid[])
       ORDER BY created_at`,
      [tickets.rows.map((row) => row.id)],
    );
    for (const row of items.rows) {
      if (!itemMap[row.ticket_id]) {
        itemMap[row.ticket_id] = [];
      }
      itemMap[row.ticket_id].push({ category: row.category, quantity: Number(row.quantity) || 1 });
    }
  }
  const assets = await query(
    `SELECT id, asset_code, category, brand, model, serial_number, location, condition
     FROM assets
     WHERE status = $1
     ORDER BY asset_code`,
    [STATUS.AVAILABLE],
  );

  res.json({
    ok: true,
    employees: employees.rows.map((row) => ({
      id: row.id,
      employeeCode: row.employee_code,
      name: row.name,
      department: row.department,
      location: row.location,
    })),
    tickets: tickets.rows.map((row) => {
      const lines = itemMap[row.id] || (row.category ? [{ category: row.category, quantity: row.quantity || 1 }] : []);
      return {
        id: row.id,
        ticketCode: row.ticket_code,
        employeeId: row.employee_id,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        status: row.status,
        items: lines,
        itemsLabel: lines.map((item) => `${item.category} × ${item.quantity}`).join(', '),
      };
    }),
    assets: assets.rows.map((row) => ({
      id: row.id,
      assetCode: row.asset_code,
      category: row.category,
      brand: row.brand,
      model: row.model,
      serialNumber: row.serial_number,
      location: row.location,
      condition: row.condition,
    })),
    conditions: CONDITIONS,
    assignmentTypes: ASSIGNMENT_TYPES,
    returnReasons: RETURN_REASONS,
    returnConditions: RETURN_CONDITIONS,
  });
}

async function list(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const open = String(req.query.open || '1') !== '0';
  const employee = emptyToNull(req.query.employee);
  const params = [];
  const where = [];
  if (open) {
    where.push('aa.returned_at IS NULL');
  }
  if (employee) {
    params.push(employee);
    where.push(`(e.employee_code = $${params.length} OR e.id::text = $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await query(
    `${SELECT_ASSIGNMENT}
     ${whereSql}
     ORDER BY aa.assigned_at DESC
     LIMIT 200`,
    params,
  );
  res.json({ ok: true, assignments: result.rows.map(toPublic) });
}

async function mine(req, res) {
  const person = await query(
    `SELECT id FROM employees WHERE user_id = $1 LIMIT 1`,
    [req.user.id],
  );
  if (!person.rows[0]) {
    return res.json({ ok: true, assignments: [] });
  }
  const rows = await holdingsForEmployee(person.rows[0].id);
  res.json({ ok: true, assignments: rows });
}

async function create(req, res) {
  if (!TICKET_ASSIGN_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      ok: false,
      error: 'Asset Team assigns stock after Asset Manager sends the ticket to them',
    });
  }

  const employeeId = emptyToNull(req.body?.employeeId);
  const ticketId = emptyToNull(req.body?.ticketId);
  let assetIds = req.body?.assetIds;
  if (typeof assetIds === 'string') {
    try {
      assetIds = JSON.parse(assetIds);
    } catch {
      assetIds = [];
    }
  }
  if (!Array.isArray(assetIds)) {
    assetIds = [];
  }
  assetIds = [...new Set(assetIds.map((id) => String(id)))];

  const assignedAt = asDate(req.body?.assignedAt) || asDate(new Date());
  const expectedReturn = asDate(req.body?.expectedReturn);
  const condition = emptyToNull(req.body?.condition) || 'Good';
  const location = emptyToNull(req.body?.location);
  const assignmentType = emptyToNull(req.body?.assignmentType) || 'Permanent';
  const accessories = emptyToNull(req.body?.accessories);
  const remarks = emptyToNull(req.body?.remarks);

  if (!ticketId) {
    return res.status(400).json({ ok: false, error: 'Pick a ticket' });
  }
  if (!employeeId) {
    return res.status(400).json({ ok: false, error: 'Pick an active employee' });
  }
  if (!assetIds.length) {
    return res.status(400).json({ ok: false, error: 'Pick at least one available asset' });
  }
  if (!CONDITIONS.includes(condition)) {
    return res.status(400).json({ ok: false, error: 'Condition is not valid' });
  }
  if (!ASSIGNMENT_TYPES.includes(assignmentType)) {
    return res.status(400).json({ ok: false, error: 'Assignment type is not valid' });
  }

  const client = await pool.connect();
  const savedIds = [];
  try {
    await client.query('BEGIN');

    const employee = await client.query(
      `SELECT id, employee_code, name, status FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId],
    );
    if (!employee.rows[0]) {
      throw badRequest('Employee not found');
    }
    if (employee.rows[0].status !== 'ACTIVE') {
      throw badRequest('Pick an active employee');
    }

    let ticket = null;
    if (ticketId) {
      const found = await client.query(
        `SELECT id, ticket_code, employee_id, status, category, quantity FROM tickets WHERE id = $1 LIMIT 1`,
        [ticketId],
      );
      ticket = found.rows[0];
      if (!ticket) {
        throw badRequest('Ticket not found');
      }
      if (!TICKET_ASSIGN_ROLES.includes(req.user.role)) {
        throw badRequest('Asset Team assigns stock after Asset Manager sends the ticket to them');
      }
      if (!ASSIGNABLE_TICKETS.includes(ticket.status)) {
        throw badRequest('Asset Team can assign this ticket after Asset Manager sends it to them');
      }
      if (ticket.employee_id !== employeeId) {
        throw badRequest('Ticket employee does not match the selected employee');
      }
    }

    const assets = await client.query(
      `SELECT id, asset_code, status, category FROM assets WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [assetIds],
    );
    if (assets.rows.length !== assetIds.length) {
      throw badRequest('One or more assets were not found');
    }
    const busy = assets.rows.filter((row) => row.status !== STATUS.AVAILABLE);
    if (busy.length) {
      throw badRequest(`Not available: ${busy.map((row) => row.asset_code).join(', ')}`);
    }

    if (ticketId) {
      const lines = await client.query(
        `SELECT category, quantity FROM ticket_items WHERE ticket_id = $1`,
        [ticketId],
      );
      const needed = new Map(
        (lines.rows.length
          ? lines.rows
          : ticket.category
            ? [{ category: ticket.category, quantity: ticket.quantity || 1 }]
            : []
        ).map((row) => [row.category, Number(row.quantity) || 1]),
      );
      const picked = new Map();
      for (const asset of assets.rows) {
        picked.set(asset.category, (picked.get(asset.category) || 0) + 1);
      }
      for (const [category, count] of picked) {
        const limit = needed.get(category);
        if (!limit) {
          throw badRequest(`${category} is not on this ticket`);
        }
        if (count > limit) {
          throw badRequest(`Ticket asked for ${category} × ${limit}, not ${count}`);
        }
      }
    }

    const created = [];
    for (const asset of assets.rows) {
      const id = crypto.randomUUID();
      const proof = saveAssignmentUploads(id, req.files || {});
      if (proof.documents.length) {
        savedIds.push(id);
      }
      const documentsJson = proof.documents.length ? JSON.stringify(proof.documents) : null;
      let code = await nextAssignmentCode(client);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          await client.query(
            `INSERT INTO asset_assignments (
               id, assignment_code, asset_id, employee_id, ticket_id, assigned_at,
               expected_return, purpose, assignment_type, condition, location,
               remarks, accessories, assigned_by, assigned_by_user_id, documents
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [
              id,
              code,
              asset.id,
              employeeId,
              ticketId,
              assignedAt,
              expectedReturn,
              assignmentType,
              assignmentType,
              condition,
              location,
              remarks,
              accessories,
              req.user?.email || null,
              req.user?.id || null,
              documentsJson,
            ],
          );
          break;
        } catch (err) {
          if (err.code !== '23505' || !String(err.constraint || '').includes('assignment_code')) {
            throw err;
          }
          code = await nextAssignmentCode(client);
          if (attempt === 4) {
            throw badRequest('Could not allocate an assignment ID');
          }
        }
      }
      await client.query(
        `UPDATE assets SET status = $2, employee_id = $3 WHERE id = $1`,
        [asset.id, STATUS.ASSIGNED, employeeId],
      );
      if (ticketId) {
        await client.query(
          `INSERT INTO ticket_assets (ticket_id, asset_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [ticketId, asset.id],
        );
      }
      created.push({ id, assignmentCode: code, assetCode: asset.asset_code });
    }

    if (ticketId) {
      await client.query(
        `UPDATE tickets SET status = 'CLOSED', closed_at = now() WHERE id = $1`,
        [ticketId],
      );
    }

    await client.query('COMMIT');

    await logActivity({
      user: req.user,
      module: 'Assignment',
      action: 'Assign',
      description: `Assigned ${created.map((row) => row.assetCode).join(', ')} to ${employee.rows[0].employee_code}${ticket ? ` (${ticket.ticket_code})` : ''
        }`,
      entityType: 'Employee',
      entityId: employeeId,
      ip: req.ip,
    });

    return res.status(201).json({
      ok: true,
      assignments: created,
      ticketCode: ticket?.ticket_code || null,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    savedIds.forEach(removeAssignmentUploads);
    return res.status(err.statusCode || 500).json({ ok: false, error: safeMessage(err, 'Could not assign assets') });
  } finally {
    client.release();
  }
}

async function returnOne(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const code = String(req.params.code || '').trim();
  const reason = emptyToNull(req.body?.reason);
  const returnCondition = emptyToNull(req.body?.condition);
  if (!reason || !RETURN_REASONS.includes(reason)) {
    return res.status(400).json({ ok: false, error: 'Pick a return reason' });
  }
  if (!returnCondition || !RETURN_CONDITIONS.includes(returnCondition)) {
    return res.status(400).json({ ok: false, error: 'Pick a return condition' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      `${SELECT_ASSIGNMENT}
       WHERE aa.assignment_code = $1 OR aa.id::text = $1
       LIMIT 1`,
      [code],
    );
    const row = found.rows[0];
    if (!row) {
      const err = new Error('Assignment not found');
      err.statusCode = 404;
      throw err;
    }
    if (row.returned_at) {
      throw badRequest('This assignment is already returned');
    }

    await client.query(
      `UPDATE asset_assignments
       SET returned_at = now(), return_reason = $2, return_condition = $3
       WHERE id = $1`,
      [row.id, reason, returnCondition],
    );
    await client.query(
      `UPDATE assets SET status = $2, employee_id = NULL WHERE id = $1`,
      [row.asset_id, STATUS.PENDING_PRECHECK],
    );
    await client.query('COMMIT');

    await logActivity({
      user: req.user,
      module: 'Assignment',
      action: 'Return',
      description: `Returned ${row.asset_code} from ${row.employee_code}`,
      entityType: 'Asset',
      entityId: row.asset_id,
      ip: req.ip,
    });

    return res.json({ ok: true, assignment: toPublic({ ...row, returned_at: new Date(), return_reason: reason, return_condition: returnCondition }) });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return res.status(err.statusCode || 500).json({ ok: false, error: safeMessage(err, 'Could not return asset') });
  } finally {
    client.release();
  }
}

async function findByCode(code) {
  const result = await query(
    `${SELECT_ASSIGNMENT}
     WHERE aa.assignment_code = $1 OR aa.id::text = $1
     LIMIT 1`,
    [code],
  );
  return result.rows[0] || null;
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

  const listed = parseStored(row.documents).find((item) => item.stored === stored);
  if (!listed) {
    return notFound();
  }

  res.type(listed.mime || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(listed.name || stored)}`,
  );
  return res.sendFile(path.join(ASSIGNMENT_ROOT, row.id, 'documents', stored), (err) => {
    if (err && !res.headersSent) {
      notFound();
    }
  });
}

module.exports = {
  options,
  list,
  mine,
  create,
  returnOne,
  file,
  holdingsForEmployee,
  assetsForTicket,
};
