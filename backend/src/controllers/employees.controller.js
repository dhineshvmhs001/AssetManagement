const crypto = require('crypto');
const path = require('path');
const { query } = require('../config/db');
const { logActivity } = require('../lib/activity');
const {
  EMPLOYEE_ROOT,
  saveEmployeeUploads,
  removeEmployeeUploads,
  parseStored,
  publicEmployeeFiles,
} = require('../lib/uploads');
const { ROLES } = require('../constants/roles');
const {
  PRODUCTION_MODE,
  DEPARTMENTS,
  missingRequired,
  requiredFieldKeys,
} = require('../constants/employeeRequired');

const WRITE_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.ASSET_MANAGER];
const READ_ROLES = [...WRITE_ROLES, ROLES.ASSET_TEAM, ROLES.MANAGER];
const STATUSES = ['ACTIVE', 'INACTIVE'];

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

function statusLabel(status) {
  return status === 'INACTIVE' ? 'Inactive' : 'Active';
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
    employeeCode: row.employee_code,
    name: row.name,
    department: row.department,
    designation: row.designation,
    email: row.email,
    mobile: row.mobile,
    joiningDate: asDate(row.joining_date),
    managerId: row.manager_id || null,
    managerName: row.manager_name || null,
    managerEmail: row.manager_email || null,
    location: row.location,
    status: row.status,
    statusLabel: statusLabel(row.status),
    ...publicEmployeeFiles(row.id, row.documents),
    assetCount: row.asset_count == null ? undefined : Number(row.asset_count),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function pickFields(body, { defaultStatus } = {}) {
  const out = {};
  for (const key of [
    'name',
    'department',
    'designation',
    'email',
    'mobile',
    'joiningDate',
    'managerId',
    'location',
    'status',
  ]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = emptyToNull(body[key]);
    }
  }
  if (defaultStatus && !out.status) {
    out.status = defaultStatus;
  }
  return out;
}

function validate(fields) {
  if (fields.status && !STATUSES.includes(fields.status.toUpperCase())) {
    throw badRequest('Status must be Active or Inactive');
  }
  if (fields.status) {
    fields.status = fields.status.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  }
  if (fields.department && !DEPARTMENTS.includes(fields.department)) {
    throw badRequest(`Department must be ${DEPARTMENTS.join(', ')}`);
  }
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw badRequest('Email is not valid');
  }
  if (fields.joiningDate && !/^\d{4}-\d{2}-\d{2}$/.test(fields.joiningDate)) {
    throw badRequest('Joining date is not valid');
  }
  if (fields.managerId && !/^[0-9a-f-]{36}$/i.test(fields.managerId)) {
    throw badRequest('Manager is not valid');
  }
  return fields;
}

async function assertManager(managerId) {
  if (!managerId) {
    return;
  }
  const manager = await query(
    `SELECT id, role, is_active FROM users WHERE id = $1 LIMIT 1`,
    [managerId],
  );
  if (!manager.rows[0] || manager.rows[0].role !== ROLES.MANAGER || !manager.rows[0].is_active) {
    throw badRequest('Pick a manager from the managers list');
  }
}

function assertRequired(fields, files, extra = {}) {
  const missing = missingRequired(fields, files, extra);
  if (missing.length) {
    throw badRequest(`Required: ${missing.join(', ')}`);
  }
}

function uniqueConflict(err, fields) {
  const hit = String(err.constraint || err.detail || '');
  if (hit.includes('employees_email_lower') || hit.includes('(email)')) {
    return badRequest(`Email ${fields.email} is already used by another employee`);
  }
  if (hit.includes('employees_mobile_digits') || hit.includes('(mobile)')) {
    return badRequest(`Mobile ${fields.mobile} is already used by another employee`);
  }
  if (hit.includes('employee_code')) {
    return null;
  }
  return null;
}

async function assertUnique(fields, excludeId) {
  const params = [excludeId || null];
  const notSelf = '($1::uuid IS NULL OR id <> $1)';

  if (fields.email) {
    const result = await query(
      `SELECT employee_code FROM employees WHERE lower(email) = lower($2) AND ${notSelf} LIMIT 1`,
      [...params, fields.email],
    );
    if (result.rows[0]) {
      throw badRequest(`Email ${fields.email} is already used by another employee`);
    }
  }
  if (fields.mobile) {
    const result = await query(
      `SELECT employee_code FROM employees
       WHERE regexp_replace(mobile, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')
         AND ${notSelf}
       LIMIT 1`,
      [...params, fields.mobile],
    );
    if (result.rows[0]) {
      throw badRequest(`Mobile ${fields.mobile} is already used by another employee`);
    }
  }
}

async function nextEmployeeCode() {
  const result = await query(
    `SELECT employee_code
     FROM employees
     WHERE employee_code LIKE 'EMP-%'
     ORDER BY CASE
       WHEN substring(employee_code from 5) ~ '^\\d+$'
       THEN substring(employee_code from 5)::bigint
       ELSE 0
     END DESC
     LIMIT 1`,
  );
  let n = 1;
  if (result.rows[0]) {
    const parsed = Number(String(result.rows[0].employee_code).slice(4));
    if (Number.isFinite(parsed)) {
      n = parsed + 1;
    }
  }
  return `EMP-${String(n).padStart(3, '0')}`;
}

async function insertWithCode(id, fields, documentsJson, actor) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const employeeCode = await nextEmployeeCode();
    try {
      const result = await query(
        `INSERT INTO employees (
           id, employee_code, name, department, designation, email, mobile,
           joining_date, manager_id, location, status, documents, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          id,
          employeeCode,
          fields.name,
          fields.department,
          fields.designation,
          fields.email,
          fields.mobile,
          fields.joiningDate,
          fields.managerId,
          fields.location,
          fields.status,
          documentsJson,
          actor?.email || null,
        ],
      );
      return result.rows[0];
    } catch (err) {
      if (err.code !== '23505') {
        throw err;
      }
      const unique = uniqueConflict(err, fields);
      if (unique) {
        throw unique;
      }
      if (!String(err.constraint || err.detail || '').includes('employee_code')) {
        throw err;
      }
    }
  }
  throw badRequest('Could not allocate an employee ID. Please try again.');
}

const SELECT_EMPLOYEE = `
  SELECT e.*,
         m.name AS manager_name,
         m.email AS manager_email,
         (
           SELECT COUNT(*)::int FROM assets a WHERE a.employee_id = e.id
         ) AS asset_count
  FROM employees e
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
  const assetsHeld = emptyToNull(req.query.assetsHeld);
  const params = [];
  const where = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(e.employee_code ILIKE $${params.length} OR e.name ILIKE $${params.length} OR e.email ILIKE $${params.length})`,
    );
  }
  if (status && STATUSES.includes(status.toUpperCase())) {
    params.push(status.toUpperCase());
    where.push(`e.status = $${params.length}`);
  }
  if (assetsHeld === 'with') {
    where.push(`EXISTS (SELECT 1 FROM assets a WHERE a.employee_id = e.id)`);
  }
  if (assetsHeld === 'without') {
    where.push(`NOT EXISTS (SELECT 1 FROM assets a WHERE a.employee_id = e.id)`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query(`SELECT COUNT(*)::int AS n FROM employees e ${whereSql}`, params);
  const pageParams = [...params, limit, offset];
  const result = await query(
    `${SELECT_EMPLOYEE}
     ${whereSql}
     ORDER BY e.created_at DESC
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
    employees: result.rows.map(toPublic),
    filters: { statuses: STATUSES, departments: DEPARTMENTS },
  });
}

async function create(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const id = crypto.randomUUID();
  let saved = { documents: [] };
  try {
    const fields = validate(pickFields(req.body, { defaultStatus: 'ACTIVE' }));
    saved = saveEmployeeUploads(id, req.files || {});
    assertRequired(fields, saved);
    await assertUnique(fields);
    await assertManager(fields.managerId);
    const row = await insertWithCode(id, fields, JSON.stringify(saved.documents), req.user);
    await logActivity({
      user: req.user,
      module: 'Employee',
      action: 'Create',
      description: `Created employee ${row.employee_code} (${row.name})`,
      entityType: 'Employee',
      entityId: row.id,
      ip: req.ip,
    });
    const fresh = await findByCode(row.employee_code);
    return res.status(201).json({ ok: true, employee: toPublic(fresh) });
  } catch (err) {
    removeEmployeeUploads(id);
    return res.status(err.statusCode || 500).json({ ok: false, error: safeMessage(err, 'Could not save employee') });
  }
}

async function findByCode(code) {
  const result = await query(
    `${SELECT_EMPLOYEE}
     WHERE e.employee_code = $1 OR e.id::text = $1
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
    return res.status(404).json({ ok: false, error: 'Employee not found' });
  }
  res.json({ ok: true, employee: toPublic(row) });
}

async function update(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Employee not found' });
  }

  try {
    const incoming = pickFields(req.body);
    const fields = validate({
      name: incoming.name !== undefined ? incoming.name : row.name,
      department: incoming.department !== undefined ? incoming.department : row.department,
      designation: incoming.designation !== undefined ? incoming.designation : row.designation,
      email: incoming.email !== undefined ? incoming.email : row.email,
      mobile: incoming.mobile !== undefined ? incoming.mobile : row.mobile,
      joiningDate: incoming.joiningDate !== undefined ? incoming.joiningDate : asDate(row.joining_date),
      managerId: incoming.managerId !== undefined ? incoming.managerId : row.manager_id,
      location: incoming.location !== undefined ? incoming.location : row.location,
      status: incoming.status || row.status,
    });

    const existingDocs = parseStored(row.documents);
    const added = saveEmployeeUploads(row.id, req.files || {}).documents;
    assertRequired(fields, { documents: [...existingDocs, ...added] });
    await assertUnique(fields, row.id);
    await assertManager(fields.managerId);
    const documentsJson = JSON.stringify([...existingDocs, ...added]);

    const updated = await query(
      `UPDATE employees
       SET name = $1, department = $2, designation = $3, email = $4, mobile = $5,
           joining_date = $6, manager_id = $7, location = $8, status = $9, documents = $10
       WHERE id = $11
       RETURNING *`,
      [
        fields.name,
        fields.department,
        fields.designation,
        fields.email,
        fields.mobile,
        fields.joiningDate,
        fields.managerId,
        fields.location,
        fields.status,
        documentsJson,
        row.id,
      ],
    );

    await logActivity({
      user: req.user,
      module: 'Employee',
      action: 'Update',
      description: `Updated employee ${row.employee_code}`,
      entityType: 'Employee',
      entityId: row.id,
      ip: req.ip,
    });

    const fresh = await findByCode(updated.rows[0].employee_code);
    return res.json({ ok: true, employee: toPublic(fresh) });
  } catch (err) {
    const unique = err.code === '23505' ? uniqueConflict(err, pickFields(req.body)) : null;
    const fail = unique || err;
    return res.status(fail.statusCode || 500).json({ ok: false, error: safeMessage(fail, 'Could not update employee') });
  }
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
  return res.sendFile(path.join(EMPLOYEE_ROOT, row.id, 'documents', stored), (err) => {
    if (err && !res.headersSent) {
      notFound();
    }
  });
}

async function options(_req, res) {
  const managers = await query(
    `SELECT id, name, email
     FROM users
     WHERE role = $1 AND is_active = true
     ORDER BY name`,
    [ROLES.MANAGER],
  );
  res.json({
    ok: true,
    productionMode: PRODUCTION_MODE,
    requiredFields: requiredFieldKeys(),
    departments: DEPARTMENTS,
    managers: managers.rows,
  });
}

module.exports = { list, create, getOne, update, file, options };
