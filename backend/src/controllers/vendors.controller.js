const crypto = require('crypto');
const path = require('path');
const { query } = require('../config/db');
const { logActivity } = require('../lib/activity');
const {
  VENDOR_ROOT,
  saveVendorUploads,
  removeVendorUploads,
  parseStored,
  publicVendorFiles,
} = require('../lib/uploads');
const { ROLES } = require('../constants/roles');
const { PRODUCTION_MODE, missingRequired, requiredFieldKeys } = require('../constants/vendorRequired');

const WRITE_ROLES = [ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM];
const STATUSES = ['ACTIVE', 'INACTIVE'];

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

function statusLabel(status) {
  return status === 'INACTIVE' ? 'Inactive' : 'Active';
}

function toPublic(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    vendorCode: row.vendor_code,
    name: row.name,
    contact: row.contact,
    email: row.email,
    mobile: row.mobile,
    location: row.location,
    status: row.status,
    statusLabel: statusLabel(row.status),
    accountNumber: row.account_number,
    branch: row.branch,
    ifscCode: row.ifsc_code,
    accountHolderName: row.account_holder_name,
    ...publicVendorFiles(row.id, row.documents),
    assetCount: row.asset_count == null ? undefined : Number(row.asset_count),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function pickFields(body, { defaultStatus } = {}) {
  const out = {};
  for (const key of [
    'name',
    'contact',
    'email',
    'mobile',
    'location',
    'status',
    'accountNumber',
    'branch',
    'ifscCode',
    'accountHolderName',
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
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw badRequest('Email is not valid');
  }
  if (fields.ifscCode) {
    fields.ifscCode = fields.ifscCode.toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(fields.ifscCode)) {
      throw badRequest('IFSC code is not valid');
    }
  }
  if (fields.accountNumber) {
    fields.accountNumber = fields.accountNumber.replace(/\s+/g, '');
    if (!/^\d{6,18}$/.test(fields.accountNumber)) {
      throw badRequest('Account number must be 6 to 18 digits');
    }
  }
  return fields;
}

function assertRequired(fields, files, extra = {}) {
  const missing = missingRequired(fields, files, extra);
  if (missing.length) {
    throw badRequest(`Required: ${missing.join(', ')}`);
  }
}

function uniqueConflict(err, fields) {
  const hit = String(err.constraint || err.detail || '');
  if (hit.includes('vendors_name_lower') || (hit.includes('name') && hit.includes('already exists'))) {
    return badRequest(`A vendor named "${fields.name}" already exists`);
  }
  if (hit.includes('vendors_email_lower') || hit.includes('(email)')) {
    return badRequest(`Email ${fields.email} is already used by another vendor`);
  }
  if (hit.includes('vendors_mobile_digits') || hit.includes('(mobile)')) {
    return badRequest(`Mobile ${fields.mobile} is already used by another vendor`);
  }
  return null;
}

async function assertUnique(fields, excludeId) {
  const params = [excludeId || null];
  const notSelf = '($1::uuid IS NULL OR id <> $1)';

  if (fields.name) {
    const result = await query(
      `SELECT vendor_code FROM vendors WHERE lower(name) = lower($2) AND ${notSelf} LIMIT 1`,
      [...params, fields.name],
    );
    if (result.rows[0]) {
      throw badRequest(`A vendor named "${fields.name}" already exists`);
    }
  }
  if (fields.email) {
    const result = await query(
      `SELECT vendor_code FROM vendors WHERE lower(email) = lower($2) AND ${notSelf} LIMIT 1`,
      [...params, fields.email],
    );
    if (result.rows[0]) {
      throw badRequest(`Email ${fields.email} is already used by another vendor`);
    }
  }
  if (fields.mobile) {
    const result = await query(
      `SELECT vendor_code FROM vendors
       WHERE regexp_replace(mobile, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')
         AND ${notSelf}
       LIMIT 1`,
      [...params, fields.mobile],
    );
    if (result.rows[0]) {
      throw badRequest(`Mobile ${fields.mobile} is already used by another vendor`);
    }
  }
}

async function nextVendorCode() {
  const result = await query(
    `SELECT vendor_code
     FROM vendors
     WHERE vendor_code LIKE 'VEN-%'
     ORDER BY CASE
       WHEN substring(vendor_code from 5) ~ '^\\d+$'
       THEN substring(vendor_code from 5)::bigint
       ELSE 0
     END DESC
     LIMIT 1`,
  );
  let n = 1;
  if (result.rows[0]) {
    const parsed = Number(String(result.rows[0].vendor_code).slice(4));
    if (Number.isFinite(parsed)) {
      n = parsed + 1;
    }
  }
  return `VEN-${String(n).padStart(3, '0')}`;
}

async function insertWithCode(id, fields, documentsJson, actor) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const vendorCode = await nextVendorCode();
    try {
      const result = await query(
        `INSERT INTO vendors (
           id, vendor_code, name, contact, email, mobile, location, status,
           account_number, branch, ifsc_code, account_holder_name, documents, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          id,
          vendorCode,
          fields.name,
          fields.contact,
          fields.email,
          fields.mobile,
          fields.location,
          fields.status,
          fields.accountNumber,
          fields.branch,
          fields.ifscCode,
          fields.accountHolderName,
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
      if (!String(err.constraint || err.detail || '').includes('vendor_code')) {
        throw err;
      }
    }
  }
  throw badRequest('Could not allocate a vendor ID. Please try again.');
}

async function list(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = emptyToNull(req.query.search);
  const status = emptyToNull(req.query.status);
  const params = [];
  const where = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(v.vendor_code ILIKE $${params.length} OR v.name ILIKE $${params.length} OR v.contact ILIKE $${params.length} OR v.email ILIKE $${params.length})`,
    );
  }
  if (status && STATUSES.includes(status.toUpperCase())) {
    params.push(status.toUpperCase());
    where.push(`v.status = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query(`SELECT COUNT(*)::int AS n FROM vendors v ${whereSql}`, params);
  const pageParams = [...params, limit, offset];
  const result = await query(
    `SELECT v.*, (
        SELECT COUNT(*)::int FROM assets a
        WHERE a.vendor_id = v.id OR lower(a.vendor) = lower(v.name)
     ) AS asset_count
     FROM vendors v
     ${whereSql}
     ORDER BY v.created_at DESC
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
    vendors: result.rows.map(toPublic),
    filters: { statuses: STATUSES },
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
    saved = saveVendorUploads(id, req.files || {});
    assertRequired(fields, saved);
    await assertUnique(fields);
    const row = await insertWithCode(id, fields, JSON.stringify(saved.documents), req.user);
    await logActivity({
      user: req.user,
      module: 'Vendor',
      action: 'Create',
      description: `Created vendor ${row.vendor_code} (${row.name})`,
      entityType: 'Vendor',
      entityId: row.id,
      ip: req.ip,
    });
    return res.status(201).json({ ok: true, vendor: toPublic(row) });
  } catch (err) {
    removeVendorUploads(id);
    return res.status(err.statusCode || 500).json({ ok: false, error: safeMessage(err, 'Could not save vendor') });
  }
}

async function findByCode(code) {
  const result = await query(
    `SELECT v.*, (
        SELECT COUNT(*)::int FROM assets a
        WHERE a.vendor_id = v.id OR lower(a.vendor) = lower(v.name)
     ) AS asset_count
     FROM vendors v
     WHERE v.vendor_code = $1 OR v.id::text = $1
     LIMIT 1`,
    [code],
  );
  return result.rows[0] || null;
}

async function getOne(req, res) {
  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Vendor not found' });
  }
  res.json({ ok: true, vendor: toPublic(row) });
}

async function update(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const row = await findByCode(String(req.params.code || '').trim());
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Vendor not found' });
  }

  try {
    const incoming = pickFields(req.body);
    const fields = validate({
      name: incoming.name !== undefined ? incoming.name : row.name,
      contact: incoming.contact !== undefined ? incoming.contact : row.contact,
      email: incoming.email !== undefined ? incoming.email : row.email,
      mobile: incoming.mobile !== undefined ? incoming.mobile : row.mobile,
      location: incoming.location !== undefined ? incoming.location : row.location,
      status: incoming.status || row.status,
      accountNumber: incoming.accountNumber !== undefined ? incoming.accountNumber : row.account_number,
      branch: incoming.branch !== undefined ? incoming.branch : row.branch,
      ifscCode: incoming.ifscCode !== undefined ? incoming.ifscCode : row.ifsc_code,
      accountHolderName:
        incoming.accountHolderName !== undefined ? incoming.accountHolderName : row.account_holder_name,
    });

    const existingDocs = parseStored(row.documents);
    const added = saveVendorUploads(row.id, req.files || {}).documents;
    assertRequired(fields, { documents: [...existingDocs, ...added] });
    await assertUnique(fields, row.id);
    const documentsJson = JSON.stringify([...existingDocs, ...added]);

    const updated = await query(
      `UPDATE vendors
       SET name = $1, contact = $2, email = $3, mobile = $4, location = $5, status = $6,
           account_number = $7, branch = $8, ifsc_code = $9, account_holder_name = $10, documents = $11
       WHERE id = $12
       RETURNING *`,
      [
        fields.name,
        fields.contact,
        fields.email,
        fields.mobile,
        fields.location,
        fields.status,
        fields.accountNumber,
        fields.branch,
        fields.ifscCode,
        fields.accountHolderName,
        documentsJson,
        row.id,
      ],
    );

    await logActivity({
      user: req.user,
      module: 'Vendor',
      action: 'Update',
      description: `Updated vendor ${row.vendor_code}`,
      entityType: 'Vendor',
      entityId: row.id,
      ip: req.ip,
    });

    const fresh = await findByCode(updated.rows[0].vendor_code);
    return res.json({ ok: true, vendor: toPublic(fresh) });
  } catch (err) {
    const unique = err.code === '23505' ? uniqueConflict(err, pickFields(req.body)) : null;
    const fail = unique || err;
    return res.status(fail.statusCode || 500).json({ ok: false, error: safeMessage(fail, 'Could not update vendor') });
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
  return res.sendFile(path.join(VENDOR_ROOT, row.id, 'documents', stored), (err) => {
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
  });
}

module.exports = { list, create, getOne, update, file, options };
