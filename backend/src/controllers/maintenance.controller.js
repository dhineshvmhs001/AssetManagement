const crypto = require('crypto');
const path = require('path');
const { pool, query } = require('../config/db');
const { logActivity } = require('../lib/activity');
const {
  MAINTENANCE_ROOT,
  saveMaintenanceUploads,
  removeMaintenanceUploads,
  parseStored,
  publicMaintenanceFiles,
} = require('../lib/uploads');
const { ROLES } = require('../constants/roles');
const { STATUS, CONDITIONS, statusLabel } = require('../constants/assetStatus');

const WRITE_ROLES = [ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM];

const RESULTS = {
  PASS: { label: 'Pass — available', status: STATUS.AVAILABLE },
  REPAIR: { label: 'Needs repair', status: STATUS.MAINTENANCE },
  DAMAGED: { label: 'Damaged — not usable', status: STATUS.DAMAGED },
  LOST: { label: 'Lost / incomplete', status: STATUS.LOST },
  RETIRED: { label: 'Retire / dispose', status: STATUS.RETIRED },
};

const WARRANTY_STATUSES = ['In warranty', 'Out of warranty', 'Claim filed'];
const REPAIR_STATUSES = ['Open', 'In progress', 'Waiting parts', 'Completed'];
const COMPLETE_OUTCOMES = {
  AVAILABLE: { label: 'Repair done — available', status: STATUS.AVAILABLE },
  DAMAGED: { label: 'Still damaged', status: STATUS.DAMAGED },
  RETIRED: { label: 'Retire / dispose', status: STATUS.RETIRED },
};

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

function asBool(value) {
  return value === true || value === 'true' || value === '1' || value === 'on';
}

function isoDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value.slice(0, 10);
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function asMoney(value) {
  const raw = emptyToNull(value);
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) {
    throw badRequest('Repair cost must be a number 0 or more');
  }
  return n;
}

function toAsset(row) {
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
    location: row.location,
    condition: row.condition,
    status: row.status,
    statusLabel: statusLabel(row.status),
    warrantyStart: isoDate(row.warranty_start),
    warrantyEnd: isoDate(row.warranty_end),
    lastAssignment: row.last_assignment_id
      ? {
          id: row.last_assignment_id,
          assignmentCode: row.assignment_code,
          employeeCode: row.employee_code,
          employeeName: row.employee_name,
          returnedAt: row.returned_at,
          returnReason: row.return_reason,
          returnCondition: row.return_condition,
          accessories: row.last_accessories || null,
        }
      : null,
    openCheck: row.check_id
      ? {
          id: row.check_id,
          result: row.check_result,
          notes: row.check_notes,
          accessories: row.check_accessories,
          serviceProvider: row.service_provider,
          repairCost: row.repair_cost,
          repairDetails: row.repair_details,
          repairStatus: row.repair_status,
          createdAt: row.check_created_at,
        }
      : null,
  };
}

function toCheck(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    assetId: row.asset_id,
    assetCode: row.asset_code,
    category: row.category,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    assetStatus: row.asset_status,
    assetStatusLabel: row.asset_status ? statusLabel(row.asset_status) : null,
    assignmentId: row.assignment_id,
    result: row.result,
    resultLabel: RESULTS[row.result]?.label || row.result,
    notes: row.notes,
    accessories: row.accessories,
    ...publicMaintenanceFiles(row.id, row.photos),
    warrantyApplicable: Boolean(row.warranty_applicable),
    warrantyStatus: row.warranty_status,
    warrantyExpiry: isoDate(row.warranty_expiry),
    claimNumber: row.claim_number,
    serviceProvider: row.service_provider,
    repairCost: row.repair_cost,
    repairDetails: row.repair_details,
    repairStatus: row.repair_status,
    checkedBy: row.checked_by,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

const LAST_ASSIGNMENT = `
LEFT JOIN LATERAL (
  SELECT aa.id, aa.assignment_code, aa.returned_at, aa.return_reason, aa.return_condition,
         aa.accessories, e.employee_code, e.name AS employee_name
  FROM asset_assignments aa
  JOIN employees e ON e.id = aa.employee_id
  WHERE aa.asset_id = a.id AND aa.returned_at IS NOT NULL
  ORDER BY aa.returned_at DESC
  LIMIT 1
) last ON true`;

const OPEN_CHECK = `
LEFT JOIN LATERAL (
  SELECT mc.id AS check_id, mc.result AS check_result, mc.notes AS check_notes,
         mc.accessories AS check_accessories, mc.service_provider, mc.repair_cost,
         mc.repair_details, mc.repair_status, mc.created_at AS check_created_at
  FROM maintenance_checks mc
  WHERE mc.asset_id = a.id AND mc.completed_at IS NULL
  ORDER BY mc.created_at DESC
  LIMIT 1
) chk ON true`;

const ASSET_SELECT = `
SELECT a.id, a.asset_code, a.category, a.brand, a.model, a.serial_number,
       a.location, a.condition, a.status, a.warranty_start, a.warranty_end,
       last.id AS last_assignment_id, last.assignment_code, last.returned_at,
       last.return_reason, last.return_condition, last.accessories AS last_accessories,
       last.employee_code, last.employee_name`;

async function findAsset(client, code) {
  const found = await client.query(
    `SELECT * FROM assets WHERE asset_code = $1 OR id::text = $1 LIMIT 1`,
    [code],
  );
  return found.rows[0] || null;
}

async function options(_req, res) {
  const vendors = await query(
    `SELECT name FROM vendors WHERE status = 'ACTIVE' ORDER BY name`,
  );
  res.json({
    ok: true,
    results: Object.entries(RESULTS).map(([value, item]) => ({ value, label: item.label })),
    conditions: CONDITIONS,
    warrantyStatuses: WARRANTY_STATUSES,
    repairStatuses: REPAIR_STATUSES.filter((item) => item !== 'Completed'),
    completeOutcomes: Object.entries(COMPLETE_OUTCOMES).map(([value, item]) => ({
      value,
      label: item.label,
    })),
    vendors: vendors.rows.map((row) => row.name),
  });
}

async function queue(_req, res) {
  const result = await query(
    `${ASSET_SELECT}
     FROM assets a
     ${LAST_ASSIGNMENT}
     WHERE a.status = $1
     ORDER BY last.returned_at DESC NULLS LAST, a.asset_code`,
    [STATUS.PENDING_PRECHECK],
  );
  res.json({ ok: true, assets: result.rows.map(toAsset) });
}

async function repairs(_req, res) {
  const result = await query(
    `${ASSET_SELECT},
       chk.check_id, chk.check_result, chk.check_notes, chk.check_accessories,
       chk.service_provider, chk.repair_cost, chk.repair_details, chk.repair_status,
       chk.check_created_at
     FROM assets a
     ${LAST_ASSIGNMENT}
     ${OPEN_CHECK}
     WHERE a.status = $1
     ORDER BY chk.check_created_at DESC NULLS LAST, a.asset_code`,
    [STATUS.MAINTENANCE],
  );
  res.json({ ok: true, assets: result.rows.map(toAsset) });
}

async function recent(_req, res) {
  const result = await query(
    `SELECT mc.*, a.asset_code, a.category, a.brand, a.model, a.serial_number,
            a.status AS asset_status
     FROM maintenance_checks mc
     JOIN assets a ON a.id = mc.asset_id
     ORDER BY COALESCE(mc.completed_at, mc.created_at) DESC
     LIMIT 40`,
  );
  res.json({ ok: true, checks: result.rows.map(toCheck) });
}

async function check(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const code = String(req.params.code || '').trim();
  const resultKey = emptyToNull(req.body?.result);
  const mapped = RESULTS[resultKey];
  if (!mapped) {
    return res.status(400).json({ ok: false, error: 'Pick an inspection result' });
  }

  const condition = emptyToNull(req.body?.condition);
  if (condition && !CONDITIONS.includes(condition)) {
    return res.status(400).json({ ok: false, error: 'Pick a valid condition' });
  }

  const notes = emptyToNull(req.body?.notes);
  if (resultKey !== 'PASS' && !notes) {
    return res.status(400).json({ ok: false, error: 'Add notes for anything other than a pass' });
  }

  const warrantyApplicable = asBool(req.body?.warrantyApplicable);
  const warrantyStatus = emptyToNull(req.body?.warrantyStatus);
  if (warrantyStatus && !WARRANTY_STATUSES.includes(warrantyStatus)) {
    return res.status(400).json({ ok: false, error: 'Pick a warranty status' });
  }
  if (warrantyApplicable && warrantyStatus === 'Claim filed' && !emptyToNull(req.body?.claimNumber)) {
    return res.status(400).json({ ok: false, error: 'Claim number is required when a claim is filed' });
  }

  let repairCost;
  try {
    repairCost = asMoney(req.body?.repairCost);
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const repairStatus = emptyToNull(req.body?.repairStatus) || (resultKey === 'REPAIR' ? 'Open' : null);
  if (repairStatus && !REPAIR_STATUSES.includes(repairStatus)) {
    return res.status(400).json({ ok: false, error: 'Pick a repair status' });
  }
  if (resultKey === 'REPAIR' && !emptyToNull(req.body?.repairDetails)) {
    return res.status(400).json({ ok: false, error: 'Describe what needs repair' });
  }

  const id = crypto.randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const asset = await findAsset(client, code);
    if (!asset) {
      const err = new Error('Asset not found');
      err.statusCode = 404;
      throw err;
    }
    if (asset.status !== STATUS.PENDING_PRECHECK) {
      throw badRequest('This asset is not waiting for pre-check');
    }

    const last = await client.query(
      `SELECT id FROM asset_assignments
       WHERE asset_id = $1 AND returned_at IS NOT NULL
       ORDER BY returned_at DESC
       LIMIT 1`,
      [asset.id],
    );

    const photos = saveMaintenanceUploads(id, req.files).photos;
    const completedAt = resultKey === 'REPAIR' ? null : new Date();

    await client.query(
      `INSERT INTO maintenance_checks (
         id, asset_id, assignment_id, result, notes, accessories, photos,
         warranty_applicable, warranty_status, warranty_expiry, claim_number,
         service_provider, repair_cost, repair_details, repair_status,
         checked_by, checked_by_user_id, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        id,
        asset.id,
        last.rows[0]?.id || null,
        resultKey,
        notes,
        emptyToNull(req.body?.accessories),
        JSON.stringify(photos),
        warrantyApplicable,
        warrantyApplicable ? warrantyStatus : null,
        warrantyApplicable ? emptyToNull(req.body?.warrantyExpiry) || asset.warranty_end : null,
        warrantyApplicable ? emptyToNull(req.body?.claimNumber) : null,
        resultKey === 'REPAIR' ? emptyToNull(req.body?.serviceProvider) : null,
        resultKey === 'REPAIR' ? repairCost : null,
        resultKey === 'REPAIR' ? emptyToNull(req.body?.repairDetails) : null,
        resultKey === 'REPAIR' ? repairStatus : null,
        req.user.email,
        req.user.id,
        completedAt,
      ],
    );

    await client.query(
      `UPDATE assets SET status = $2, condition = COALESCE($3, condition), employee_id = NULL
       WHERE id = $1`,
      [asset.id, mapped.status, condition],
    );
    await client.query('COMMIT');

    await logActivity({
      user: req.user,
      module: 'Maintenance',
      action: 'Pre-check',
      description: `${asset.asset_code}: ${mapped.label}`,
      entityType: 'Asset',
      entityId: asset.id,
      ip: req.ip,
    });

    const saved = await query(
      `SELECT mc.*, a.asset_code, a.category, a.brand, a.model, a.serial_number,
              a.status AS asset_status
       FROM maintenance_checks mc
       JOIN assets a ON a.id = mc.asset_id
       WHERE mc.id = $1`,
      [id],
    );
    return res.status(201).json({ ok: true, check: toCheck(saved.rows[0]) });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    removeMaintenanceUploads(id);
    return res.status(err.statusCode || 500).json({ ok: false, error: safeMessage(err, 'Could not save pre-check') });
  } finally {
    client.release();
  }
}

async function completeRepair(req, res) {
  if (!canWrite(req.user)) {
    return res.status(403).json({ ok: false, error: 'Not allowed for this role' });
  }

  const code = String(req.params.code || '').trim();
  const outcome = emptyToNull(req.body?.outcome);
  const mapped = COMPLETE_OUTCOMES[outcome];
  if (!mapped) {
    return res.status(400).json({ ok: false, error: 'Pick a repair outcome' });
  }

  let repairCost;
  try {
    repairCost = asMoney(req.body?.repairCost);
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const notes = emptyToNull(req.body?.notes);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const asset = await findAsset(client, code);
    if (!asset) {
      const err = new Error('Asset not found');
      err.statusCode = 404;
      throw err;
    }
    if (asset.status !== STATUS.MAINTENANCE) {
      throw badRequest('This asset is not under maintenance');
    }

    const open = await client.query(
      `SELECT * FROM maintenance_checks
       WHERE asset_id = $1 AND completed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [asset.id],
    );
    const existing = open.rows[0];
    const mergedNotes = [existing?.notes, notes].filter(Boolean).join('\n');

    if (existing) {
      await client.query(
        `UPDATE maintenance_checks
         SET completed_at = now(),
             repair_status = 'Completed',
             repair_cost = COALESCE($2, repair_cost),
             notes = $3,
             checked_by = COALESCE(checked_by, $4),
             checked_by_user_id = COALESCE(checked_by_user_id, $5)
         WHERE id = $1`,
        [existing.id, repairCost, mergedNotes || existing.notes, req.user.email, req.user.id],
      );
    } else {
      await client.query(
        `INSERT INTO maintenance_checks (
           id, asset_id, result, notes, repair_cost, repair_status,
           checked_by, checked_by_user_id, completed_at
         ) VALUES ($1,$2,'REPAIR',$3,$4,'Completed',$5,$6,now())`,
        [crypto.randomUUID(), asset.id, notes, repairCost, req.user.email, req.user.id],
      );
    }

    await client.query(`UPDATE assets SET status = $2 WHERE id = $1`, [asset.id, mapped.status]);
    await client.query('COMMIT');

    await logActivity({
      user: req.user,
      module: 'Maintenance',
      action: 'Repair complete',
      description: `${asset.asset_code}: ${mapped.label}`,
      entityType: 'Asset',
      entityId: asset.id,
      ip: req.ip,
    });

    return res.json({ ok: true, status: mapped.status, statusLabel: statusLabel(mapped.status) });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    return res.status(err.statusCode || 500).json({
      ok: false,
      error: safeMessage(err, 'Could not complete repair'),
    });
  } finally {
    client.release();
  }
}

async function file(req, res) {
  const stored = String(req.params.stored || '');
  const notFound = () => res.status(404).json({ ok: false, error: 'File not found' });
  if (!/^[A-Za-z0-9._-]+$/.test(stored) || stored.includes('..')) {
    return notFound();
  }

  const found = await query(`SELECT id, photos FROM maintenance_checks WHERE id = $1`, [req.params.id]);
  const row = found.rows[0];
  if (!row) {
    return notFound();
  }
  const listed = parseStored(row.photos).find((item) => item.stored === stored);
  if (!listed) {
    return notFound();
  }

  res.type(listed.mime || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(listed.name || stored)}`,
  );
  return res.sendFile(path.join(MAINTENANCE_ROOT, row.id, 'photos', stored), (err) => {
    if (err && !res.headersSent) {
      notFound();
    }
  });
}

module.exports = {
  options,
  queue,
  repairs,
  recent,
  check,
  completeRepair,
  file,
};
