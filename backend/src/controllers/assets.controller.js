const crypto = require('crypto');
const path = require('path');
const QRCode = require('qrcode');
const { query } = require('../config/db');
const { logActivity, listEntityHistory } = require('../lib/activity');
const { istStamp } = require('../lib/time');
const { ROOT, saveUploads, removeAssetUploads, parseStored, publicFiles } = require('../lib/uploads');
const { badRequest, cleanAssetFields } = require('../lib/assetFields');
const {
  missingRequired,
  requiredFieldKeys,
  requiredCsvHeaders,
} = require('../constants/assetRequired');
const { PRODUCTION_MODE } = require('../config/env');
const { ROLES } = require('../constants/roles');
const {
  STATUS,
  CATEGORIES,
  CONDITIONS,
  ASSET_TYPES,
  statusLabel,
  prefixFor,
} = require('../constants/assetStatus');

const WRITE_ROLES = [ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM];

const CSV_HEADERS = [
  'category',
  'brand',
  'model',
  'serial_number',
  'asset_type',
  'purchase_date',
  'purchase_cost',
  'invoice_number',
  'invoice_date',
  'vendor',
  'location',
  'condition',
  'warranty_start',
  'warranty_end',
];

function canWrite(user) {
  return user && WRITE_ROLES.includes(user.role);
}

// Only our own 4xx messages are safe to show. Anything else is a server fault
// and would leak table and column names to the browser.
function safeMessage(err, fallback) {
  if (err.statusCode && err.statusCode < 500) {
    return err.message;
  }
  console.error(`${fallback}:`, err);
  return fallback;
}

// pg hands back a DATE as a Date at local midnight. Letting JSON.stringify
// turn that into UTC shifts it to the previous day east of Greenwich, so
// read the local parts instead.
function isoDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toPublic(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    assetCode: row.asset_code,
    category: row.category,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    assetType: row.asset_type,
    purchaseDate: isoDate(row.purchase_date),
    purchaseCost: row.purchase_cost,
    invoiceNumber: row.invoice_number,
    invoiceDate: isoDate(row.invoice_date),
    vendor: row.vendor,
    location: row.location,
    condition: row.condition,
    status: row.status,
    statusLabel: statusLabel(row.status),
    warrantyStart: isoDate(row.warranty_start),
    warrantyEnd: isoDate(row.warranty_end),
    ...publicFiles(row.id, row.documents, row.images),
    vendorId: row.vendor_id || null,
    employeeId: row.employee_id || null,
    employeeCode: row.employee_code || null,
    employeeName: row.holder_name || row.employee_name || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

const ASSET_FROM = `assets a
     LEFT JOIN employees e ON e.id = a.employee_id`;
const ASSET_COLUMNS = `a.*, e.name AS holder_name, e.employee_code`;

function emptyToNull(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

async function nextAssetCode(category, brand) {
  const prefix = prefixFor(category, brand);
  // Order by the numeric suffix, not the text: plain text sort puts
  // LP-DL-10000 below LP-DL-9999 once the sequence outgrows four digits.
  const result = await query(
    `SELECT asset_code
     FROM assets
     WHERE asset_code LIKE $1
     ORDER BY CASE
       WHEN split_part(asset_code, '-', 3) ~ '^\\d+$'
       THEN split_part(asset_code, '-', 3)::bigint
       ELSE 0
     END DESC
     LIMIT 1`,
    [`${prefix}-%`],
  );
  let n = 1;
  if (result.rows[0]) {
    const last = result.rows[0].asset_code.split('-').pop();
    const parsed = Number(last);
    if (Number.isFinite(parsed)) {
      n = parsed + 1;
    }
  }
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

async function resolveVendor(name) {
  if (!name) {
    return { vendor: null, vendorId: null };
  }
  const result = await query(
    `SELECT id, name FROM vendors WHERE vendor_code = $1 OR lower(name) = lower($1) LIMIT 1`,
    [name],
  );
  if (!result.rows[0]) {
    return { vendor: name, vendorId: null };
  }
  return { vendor: result.rows[0].name, vendorId: result.rows[0].id };
}

function hitConstraint(err, column) {
  return String(err.constraint || err.detail || '').includes(column);
}

// Two people adding the same category+brand at once can both read the same
// last code. Rather than lock, let the unique index arbitrate and retry.
async function insertWithCode(id, clean, documentsJson, imagesJson, actor) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const assetCode = await nextAssetCode(clean.category, clean.brand);
    try {
      const result = await query(
        `INSERT INTO assets (
           id, asset_code, category, brand, model, serial_number, asset_type,
           purchase_date, purchase_cost, invoice_number, invoice_date, vendor, vendor_id,
           location, condition, status, warranty_start, warranty_end,
           documents, images, created_by
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,
           $8,$9,$10,$11,$12,$13,
           $14,$15,$16,$17,$18,
           $19,$20,$21
         )
         RETURNING *`,
        [
          id,
          assetCode,
          clean.category,
          clean.brand,
          clean.model,
          clean.serialNumber,
          clean.assetType,
          clean.purchaseDate,
          clean.purchaseCost,
          clean.invoiceNumber,
          clean.invoiceDate,
          clean.vendor,
          clean.vendorId,
          clean.location,
          clean.condition,
          STATUS.AVAILABLE,
          clean.warrantyStart,
          clean.warrantyEnd,
          documentsJson,
          imagesJson,
          actor?.email || null,
        ],
      );
      return result.rows[0];
    } catch (err) {
      if (err.code !== '23505') {
        throw err;
      }
      if (hitConstraint(err, 'serial_number')) {
        throw badRequest(`Duplicate serial: ${clean.serialNumber}`);
      }
      if (!hitConstraint(err, 'asset_code')) {
        throw err;
      }
      // Someone took this code first — recompute and try again.
    }
  }
  throw badRequest('Could not allocate an asset code. Please try again.');
}

async function insertAsset(fields, actor, files) {
  const skipFiles = files == null;
  const missing = missingRequired(fields, files || {}, { skipFiles });
  if (missing.length) {
    throw badRequest(`Required: ${missing.join(', ')}`);
  }

  const clean = cleanAssetFields(fields);

  const resolved = await resolveVendor(clean.vendor);
  clean.vendor = resolved.vendor;
  clean.vendorId = resolved.vendorId;

  const existing = await query(
    `SELECT id FROM assets WHERE lower(serial_number) = lower($1) LIMIT 1`,
    [clean.serialNumber],
  );
  if (existing.rows[0]) {
    throw badRequest(`Duplicate serial: ${clean.serialNumber}`);
  }

  const id = crypto.randomUUID();
  const saved = saveUploads(id, files);
  const documentsJson = saved.documents.length ? JSON.stringify(saved.documents) : emptyToNull(fields.documents);
  const imagesJson = saved.images.length ? JSON.stringify(saved.images) : emptyToNull(fields.images);

  let row;
  try {
    row = await insertWithCode(id, clean, documentsJson, imagesJson, actor);
  } catch (err) {
    // The row never landed, so the uploads on disk are orphans.
    removeAssetUploads(id);
    throw err;
  }

  await logActivity({
    user: actor,
    module: 'Inventory',
    action: 'ASSET_CREATE',
    description: `Created ${row.asset_code} (${row.serial_number})`,
    entityType: 'asset',
    entityId: row.id,
  });
  return row;
}

// The sort key arrives from the URL, so it is never interpolated raw — only
// a key present here reaches the query.
const SORTABLE = {
  assetCode: 'a.asset_code',
  category: 'a.category',
  brand: 'a.brand',
  model: 'a.model',
  serialNumber: 'a.serial_number',
  status: 'a.status',
  employeeName: 'e.name',
  location: 'a.location',
  createdAt: 'a.created_at',
};

function sortKey(value) {
  return SORTABLE[value] ? value : 'createdAt';
}

function sortDir(value) {
  return String(value || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function orderBy(sort, dir) {
  const column = SORTABLE[sortKey(sort)];
  const direction = sortDir(dir) === 'asc' ? 'ASC' : 'DESC';
  // NULLS LAST keeps blank models and unassigned holders at the bottom in
  // both directions instead of filling the first page on an ascending sort.
  // asset_code breaks ties so a row cannot shift between pages.
  return `ORDER BY ${column} ${direction} NULLS LAST, a.asset_code ASC`;
}

// Search, category and location narrow both the rows and the status counts.
// Status is kept separate: the count tiles must keep showing the whole
// breakdown even while the list is filtered down to a single status.
function buildFilters(queryParams) {
  const search = String(queryParams.search || '').trim();
  const category = String(queryParams.category || '').trim();
  const location = String(queryParams.location || '').trim();
  const status = String(queryParams.status || '').trim();

  const where = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(a.asset_code ILIKE $${params.length} OR a.serial_number ILIKE $${params.length} OR a.brand ILIKE $${params.length} OR a.model ILIKE $${params.length})`,
    );
  }
  if (category) {
    params.push(category);
    where.push(`a.category = $${params.length}`);
  }
  if (location) {
    params.push(`%${location}%`);
    where.push(`a.location ILIKE $${params.length}`);
  }

  const countWhere = [...where];
  const countParams = [...params];

  if (status) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
    countWhereSql: countWhere.length ? `WHERE ${countWhere.join(' AND ')}` : '',
    countParams,
  };
}

// PRD 7.1: Total, Available, Assigned, Under Maintenance, Damaged, Lost and
// Retired/Disposed. Statuses with no rows still come back as 0 so the tiles
// keep a fixed shape instead of appearing and disappearing.
async function statusCounts(whereSql, params) {
  const result = await query(
    `SELECT a.status, COUNT(*)::int AS n FROM ${ASSET_FROM} ${whereSql} GROUP BY a.status`,
    params,
  );
  const byStatus = Object.fromEntries(Object.keys(STATUS).map((key) => [key, 0]));
  let total = 0;
  result.rows.forEach((row) => {
    if (row.status in byStatus) {
      byStatus[row.status] = row.n;
    }
    total += row.n;
  });
  return { total, byStatus };
}

async function list(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { whereSql, params, countWhereSql, countParams } = buildFilters(req.query);

  const count = await query(`SELECT COUNT(*)::int AS n FROM ${ASSET_FROM} ${whereSql}`, params);
  const counts = await statusCounts(countWhereSql, countParams);

  const pageParams = [...params, limit, offset];
  const result = await query(
    `SELECT ${ASSET_COLUMNS} FROM ${ASSET_FROM} ${whereSql}
     ${orderBy(req.query.sort, req.query.dir)}
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
    sort: sortKey(req.query.sort),
    dir: sortDir(req.query.dir),
    counts,
    assets: result.rows.map(toPublic),
    filters: { categories: CATEGORIES, statuses: Object.keys(STATUS) },
  });
}

// Export mirrors the list columns plus the purchase and warranty fields, so
// the file answers the questions the table cannot fit.
const EXPORT_FIELDS = [
  ['Asset Code', (a) => a.assetCode],
  ['Category', (a) => a.category],
  ['Brand', (a) => a.brand],
  ['Model', (a) => a.model],
  ['Serial Number', (a) => a.serialNumber],
  ['Asset Type', (a) => a.assetType],
  ['Status', (a) => a.statusLabel],
  ['Employee Code', (a) => a.employeeCode],
  ['Employee', (a) => a.employeeName],
  ['Location', (a) => a.location],
  ['Condition', (a) => a.condition],
  ['Vendor', (a) => a.vendor],
  ['Purchase Date', (a) => a.purchaseDate],
  ['Purchase Cost', (a) => a.purchaseCost],
  ['Invoice Number', (a) => a.invoiceNumber],
  ['Invoice Date', (a) => a.invoiceDate],
  ['Warranty Start', (a) => a.warrantyStart],
  ['Warranty End', (a) => a.warrantyEnd],
  ['Created By', (a) => a.createdBy],
  // ISO, not the default Date toString — that renders as "Thu Aug 20 2026
  // 15:20:54 GMT+0530 (India Standard Time)" and no spreadsheet parses it.
  ['Created At', (a) => (a.createdAt ? istStamp(a.createdAt) : '')],
];

const EXPORT_LIMIT = 5000;

// Excel and Sheets treat a leading =, +, - or @ as a formula, so a vendor
// saved as "-Dell" would execute on open. Prefix those with a quote.
function csvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let text = String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function exportCsv(req, res) {
  const { whereSql, params } = buildFilters(req.query);

  // Export deliberately ignores paging — it is the whole filtered set — but
  // stays capped so one click cannot pull an unbounded result into memory.
  const result = await query(
    `SELECT ${ASSET_COLUMNS} FROM ${ASSET_FROM} ${whereSql}
     ${orderBy(req.query.sort, req.query.dir)}
     LIMIT ${EXPORT_LIMIT}`,
    params,
  );

  const rows = result.rows.map(toPublic);
  const lines = [
    EXPORT_FIELDS.map(([header]) => csvCell(header)).join(','),
    ...rows.map((asset) => EXPORT_FIELDS.map(([, read]) => csvCell(read(asset))).join(',')),
  ];

  await logActivity({
    user: req.user,
    module: 'Inventory',
    action: 'ASSET_EXPORT',
    description: `Exported ${rows.length} assets`,
    entityType: 'asset',
    ip: req.ip,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="assets_export.csv"');
  // The BOM is what makes Excel read the file as UTF-8 rather than latin-1.
  res.send(`\uFEFF${lines.join('\n')}\n`);
}

// PRD 7.1: "Asset Details (history)". Reads back what logActivity already
// writes. Assignment and Maintenance log against the same entity_id, so
// their entries appear here as soon as those modules exist.
async function history(req, res) {
  const code = String(req.params.code || '').trim();
  const asset = await query(
    `SELECT id, asset_code FROM assets WHERE asset_code = $1 OR id::text = $1 LIMIT 1`,
    [code],
  );
  if (!asset.rows[0]) {
    return res.status(404).json({ ok: false, error: 'Asset not found' });
  }

  const history = await listEntityHistory('asset', asset.rows[0].id);
  res.json({
    ok: true,
    assetCode: asset.rows[0].asset_code,
    history,
  });
}

async function create(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  try {
    const row = await insertAsset(req.body || {}, req.user, req.files || {});
    res.status(201).json({ ok: true, asset: toPublic(row) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: safeMessage(err, 'Could not save asset') });
  }
}

async function getOne(req, res) {
  const code = String(req.params.code || '').trim();
  const result = await query(
    `SELECT ${ASSET_COLUMNS} FROM ${ASSET_FROM}
     WHERE a.asset_code = $1 OR a.id::text = $1
     LIMIT 1`,
    [code],
  );
  if (!result.rows[0]) {
    return res.status(404).json({ ok: false, error: 'Asset not found' });
  }
  res.json({ ok: true, asset: toPublic(result.rows[0]) });
}

// The sticker carries the details as plain text, so scanning shows them on
// any phone with no app and no login. That makes the values a snapshot:
// status and holder are true as of the printed date on the last line, and a
// reassigned asset needs a reprint. Purchase cost and invoice details are
// left out on purpose — anyone who can reach the item can read this.
function stickerText(asset) {
  const lines = [
    asset.assetCode,
    [asset.brand, asset.model].filter(Boolean).join(' '),
    [asset.category, asset.assetType, asset.condition].filter(Boolean).join(' / '),
    `Serial: ${asset.serialNumber}`,
    `Status: ${asset.statusLabel}`,
  ];
  if (asset.employeeName) {
    lines.push(`Holder: ${asset.employeeName}${asset.employeeCode ? ` (${asset.employeeCode})` : ''}`);
  }
  if (asset.location) {
    lines.push(`Location: ${asset.location}`);
  }
  if (asset.warrantyEnd) {
    lines.push(`Warranty to: ${asset.warrantyEnd}`);
  }
  lines.push(`Printed: ${isoDate(new Date())}`);
  return lines.filter((line) => line !== '').join('\n');
}

async function qr(req, res) {
  const code = String(req.params.code || '').trim();
  const result = await query(
    `SELECT ${ASSET_COLUMNS} FROM ${ASSET_FROM}
     WHERE a.asset_code = $1 OR a.id::text = $1
     LIMIT 1`,
    [code],
  );
  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({ ok: false, error: 'Asset not found' });
  }
  const asset = toPublic(row);
  const payload = stickerText(asset);
  // Rendered well above its printed size: the details make a denser code than
  // a bare asset id did, and a downscaled high-res PNG prints sharp modules
  // where a 240px one would print blurred and fail to scan.
  const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 512 });
  res.json({ ok: true, asset, qr: dataUrl, qrText: payload });
}

// Quote-aware, so a value like "Dell, Inc" stays one field instead of
// silently shifting every column after it.
function splitCsvRows(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') {
        field += ch;
      } else if (src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  return rows.filter((cols) => cols.some((col) => col.trim() !== ''));
}

// Tolerates the "*" the template puts on required columns, and spaces.
function normalizeHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .replace(/\*+$/, '')
    .trim()
    .replace(/\s+/g, '_');
}

// Streams one uploaded file. Reached only through the auth middleware, and
// the name must be one this asset actually owns — so a guessed or crafted
// path cannot walk out of the asset's own folder.
async function file(req, res) {
  const kind = ['documents', 'images'].includes(req.params.kind) ? req.params.kind : null;
  const stored = String(req.params.stored || '');
  const notFound = () => res.status(404).json({ ok: false, error: 'File not found' });

  if (!kind || !/^[A-Za-z0-9._-]+$/.test(stored) || stored.includes('..')) {
    return notFound();
  }

  const result = await query(
    `SELECT id, documents, images FROM assets
     WHERE asset_code = $1 OR id::text = $1
     LIMIT 1`,
    [String(req.params.code || '').trim()],
  );
  const row = result.rows[0];
  if (!row) {
    return notFound();
  }

  const listed = parseStored(kind === 'images' ? row.images : row.documents)
    .find((item) => item.stored === stored);
  if (!listed) {
    return notFound();
  }

  res.type(listed.mime || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(listed.name || stored)}`,
  );
  return res.sendFile(path.join(ROOT, row.id, kind, stored), (err) => {
    if (err && !res.headersSent) {
      notFound();
    }
  });
}

// Everything the edit form may change. Asset code and status are deliberately
// absent: the code is already printed on a sticker, and status moves through
// the assignment / maintenance flows rather than a free-form edit.
const EDITABLE = [
  'category', 'brand', 'model', 'serialNumber', 'assetType',
  'purchaseDate', 'purchaseCost', 'invoiceNumber', 'invoiceDate',
  'vendor', 'location', 'condition', 'warrantyStart', 'warrantyEnd',
];

function rowToFields(row) {
  return {
    category: row.category,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    assetType: row.asset_type,
    purchaseDate: isoDate(row.purchase_date),
    purchaseCost: row.purchase_cost,
    invoiceNumber: row.invoice_number,
    invoiceDate: isoDate(row.invoice_date),
    vendor: row.vendor,
    location: row.location,
    condition: row.condition,
    warrantyStart: isoDate(row.warranty_start),
    warrantyEnd: isoDate(row.warranty_end),
  };
}

async function updateAsset(code, fields, actor, files) {
  const found = await query(
    `SELECT * FROM assets WHERE asset_code = $1 OR id::text = $1 LIMIT 1`,
    [code],
  );
  const current = found.rows[0];
  if (!current) {
    const err = new Error('Asset not found');
    err.statusCode = 404;
    throw err;
  }

  // Start from what is stored and apply only the keys the caller sent, so a
  // partial edit never blanks a field it did not mention. `strict` is the set
  // that genuinely changes value — only those get validated, so a row saved
  // before these rules existed stays editable.
  const before = rowToFields(current);
  const merged = { ...before };
  const strict = new Set();
  const asText = (value) => (value == null ? '' : String(value).trim());

  for (const key of EDITABLE) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) {
      continue;
    }
    merged[key] = fields[key];
    if (asText(fields[key]) !== asText(before[key])) {
      strict.add(key);
    }
  }

  const existingDocs = parseStored(current.documents);
  const existingImages = parseStored(current.images);
  const missing = missingRequired(merged, {
    documents: [...existingDocs, ...(files?.documents || [])],
    images: [...existingImages, ...(files?.images || [])],
  });
  if (missing.length) {
    throw badRequest(`Required: ${missing.join(', ')}`);
  }

  const clean = cleanAssetFields(merged, { strict });

  const resolved = await resolveVendor(clean.vendor);
  clean.vendor = resolved.vendor;
  clean.vendorId = resolved.vendorId;

  const clash = await query(
    `SELECT id FROM assets WHERE lower(serial_number) = lower($1) AND id <> $2 LIMIT 1`,
    [clean.serialNumber, current.id],
  );
  if (clash.rows[0]) {
    throw badRequest(`Duplicate serial: ${clean.serialNumber}`);
  }

  // New uploads are added to what is already there, not swapped for it.
  const saved = saveUploads(current.id, files || {});
  const documents = [...existingDocs, ...saved.documents];
  const images = [...existingImages, ...saved.images];

  let updated;
  try {
    const result = await query(
      `UPDATE assets SET
         category = $2, brand = $3, model = $4, serial_number = $5, asset_type = $6,
         purchase_date = $7, purchase_cost = $8, invoice_number = $9, invoice_date = $10,
         vendor = $11, vendor_id = $12, location = $13, condition = $14,
         warranty_start = $15, warranty_end = $16, documents = $17, images = $18
       WHERE id = $1
       RETURNING *`,
      [
        current.id,
        clean.category,
        clean.brand,
        clean.model,
        clean.serialNumber,
        clean.assetType,
        clean.purchaseDate,
        clean.purchaseCost,
        clean.invoiceNumber,
        clean.invoiceDate,
        clean.vendor,
        clean.vendorId,
        clean.location,
        clean.condition,
        clean.warrantyStart,
        clean.warrantyEnd,
        documents.length ? JSON.stringify(documents) : null,
        images.length ? JSON.stringify(images) : null,
      ],
    );
    updated = result.rows[0];
  } catch (err) {
    if (err.code === '23505' && hitConstraint(err, 'serial_number')) {
      throw badRequest(`Duplicate serial: ${clean.serialNumber}`);
    }
    throw err;
  }

  const changed = EDITABLE.filter((key) => asText(before[key]) !== asText(clean[key]));
  if (saved.documents.length || saved.images.length) {
    changed.push('files');
  }

  await logActivity({
    user: actor,
    module: 'Inventory',
    action: 'ASSET_UPDATE',
    description: `Updated ${updated.asset_code}${changed.length ? `: ${changed.join(', ')}` : ' (no changes)'}`,
    entityType: 'asset',
    entityId: updated.id,
  });
  return updated;
}

async function update(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  try {
    const row = await updateAsset(
      String(req.params.code || '').trim(),
      req.body || {},
      req.user,
      req.files || {},
    );
    return res.json({ ok: true, asset: toPublic(row) });
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ ok: false, error: safeMessage(err, 'Could not update asset') });
  }
}

function parseCsv(text) {
  const rows = splitCsvRows(text);
  if (!rows.length) {
    return [];
  }
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cols, index) => {
    const data = {};
    headers.forEach((header, i) => {
      data[header] = (cols[i] || '').trim();
    });
    return { row: index + 2, data };
  });
}

async function importCsv(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }
  const csv = String(req.body?.csv || '');
  const rows = parseCsv(csv);
  const imported = [];
  const errors = [];

  for (const item of rows) {
    try {
      const row = await insertAsset(item.data, req.user);
      imported.push(toPublic(row));
    } catch (err) {
      errors.push({ row: item.row, error: safeMessage(err, 'Could not save this row') });
    }
  }

  await logActivity({
    user: req.user,
    module: 'Inventory',
    action: 'ASSET_IMPORT',
    description: `Imported ${imported.length} assets, ${errors.length} errors`,
    entityType: 'asset',
  });

  res.json({
    ok: true,
    imported: imported.length,
    errors,
    assets: imported,
  });
}

function template(_req, res) {
  const required = requiredCsvHeaders();
  const requiredSet = new Set(required);
  // A trailing "*" marks a mandatory column; the importer strips it back off.
  const headerRow = CSV_HEADERS.map((header) =>
    requiredSet.has(header) ? `${header}*` : header);

  res.json({
    ok: true,
    filename: 'assets_template.csv',
    productionMode: PRODUCTION_MODE,
    requiredHeaders: required,
    csv: `${headerRow.join(',')}\nLaptop,Dell,Latitude 5540,CN-SAMPLE-001,Own,2026-08-11,72400,INV-001,2026-08-11,Redington,HQ / Store,New,2026-08-11,2029-08-10\n`,
  });
}

async function options(_req, res) {
  try {
    const brands = await query(
      `SELECT category, brand
       FROM assets
       WHERE brand IS NOT NULL AND btrim(brand) <> ''
       GROUP BY category, brand
       ORDER BY lower(brand)`,
    );
    const brandsByCategory = {};
    brands.rows.forEach((row) => {
      if (!brandsByCategory[row.category]) {
        brandsByCategory[row.category] = [];
      }
      brandsByCategory[row.category].push(row.brand);
    });
    res.json({
      ok: true,
      productionMode: PRODUCTION_MODE,
      requiredFields: requiredFieldKeys(),
      categories: CATEGORIES,
      conditions: CONDITIONS,
      assetTypes: ASSET_TYPES,
      brandsByCategory,
      statuses: Object.keys(STATUS).map((key) => ({
        value: key,
        label: statusLabel(key),
      })),
    });
  } catch (err) {
    console.error('Asset options failed:', err);
    res.status(500).json({ ok: false, error: 'Could not load options' });
  }
}

module.exports = {
  list,
  create,
  getOne,
  qr,
  history,
  exportCsv,
  importCsv,
  template,
  options,
  parseCsv,
  file,
  update,
};
