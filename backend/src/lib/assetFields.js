const { CATEGORIES, CONDITIONS, ASSET_TYPES } = require('../constants/assetStatus');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function pick(fields, ...keys) {
  for (const key of keys) {
    const value = fields?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Accepts any casing, returns the canonical spelling from the allow list.
function choice(value, allowed, label) {
  if (value === null) {
    return null;
  }
  const match = allowed.find((item) => item.toLowerCase() === value.toLowerCase());
  if (!match) {
    throw badRequest(`${label} must be one of: ${allowed.join(', ')}`);
  }
  return match;
}

function date(value, label, { allowFuture = true } = {}) {
  if (value === null) {
    return null;
  }
  if (!DATE_RE.test(value)) {
    throw badRequest(`${label} must be a date in YYYY-MM-DD format`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw badRequest(`${label} is not a real date`);
  }
  if (!allowFuture && value > today()) {
    throw badRequest(`${label} cannot be in the future`);
  }
  return value;
}

function cost(value, label) {
  if (value === null) {
    return null;
  }
  // Rupees are recorded as whole numbers. "72,400" and "72400.00" are fine;
  // anything with real paise is rejected rather than silently rounded.
  const amount = Number(value.replace(/[\s,₹]/g, ''));
  if (!Number.isFinite(amount)) {
    throw badRequest(`${label} must be a number`);
  }
  if (amount < 0) {
    throw badRequest(`${label} cannot be negative`);
  }
  if (!Number.isInteger(amount)) {
    throw badRequest(`${label} must be a whole rupee amount`);
  }
  return amount;
}

// Validates and normalises every asset field. Collects all problems so the
// caller sees one message listing everything wrong, not just the first fault.
//
// `strict` limits checking to a set of keys. On an edit, only the fields the
// request actually changes are checked; values already in the database are
// passed through untouched. Without that, a row saved before these rules
// existed could never be edited again — you would have to fix every legacy
// field just to correct a typo in one of them.
function cleanAssetFields(fields, { strict = null } = {}) {
  const errors = [];
  const values = {};
  const check = (key) => strict === null || strict.has(key);

  function step(key, validate, raw) {
    if (!check(key)) {
      values[key] = raw();
      return;
    }
    try {
      values[key] = validate();
    } catch (err) {
      values[key] = null;
      errors.push(err.message);
    }
  }

  values.brand = pick(fields, 'brand');
  values.model = pick(fields, 'model');
  values.serialNumber = pick(fields, 'serialNumber', 'serial_number');
  values.invoiceNumber = pick(fields, 'invoiceNumber', 'invoice_number');
  values.vendor = pick(fields, 'vendor');
  values.location = pick(fields, 'location');

  const rawOf = (...keys) => () => pick(fields, ...keys);

  step('category',
    () => choice(pick(fields, 'category'), CATEGORIES, 'Category'),
    rawOf('category'));
  step('assetType',
    () => choice(pick(fields, 'assetType', 'asset_type'), ASSET_TYPES, 'Asset type') || 'Own',
    rawOf('assetType', 'asset_type'));
  step('condition',
    () => choice(pick(fields, 'condition'), CONDITIONS, 'Condition') || 'New',
    rawOf('condition'));
  step('purchaseCost',
    () => cost(pick(fields, 'purchaseCost', 'purchase_cost'), 'Purchase cost'),
    rawOf('purchaseCost', 'purchase_cost'));
  step('purchaseDate',
    () => date(pick(fields, 'purchaseDate', 'purchase_date'), 'Purchase date', { allowFuture: false }),
    rawOf('purchaseDate', 'purchase_date'));
  step('invoiceDate',
    () => date(pick(fields, 'invoiceDate', 'invoice_date'), 'Invoice date', { allowFuture: false }),
    rawOf('invoiceDate', 'invoice_date'));
  step('warrantyStart',
    () => date(pick(fields, 'warrantyStart', 'warranty_start'), 'Warranty start'),
    rawOf('warrantyStart', 'warranty_start'));
  step('warrantyEnd',
    () => date(pick(fields, 'warrantyEnd', 'warranty_end'), 'Warranty end'),
    rawOf('warrantyEnd', 'warranty_end'));

  // Compare a pair only when at least one side is being set now.
  if (
    (check('warrantyStart') || check('warrantyEnd')) &&
    values.warrantyStart && values.warrantyEnd &&
    values.warrantyEnd < values.warrantyStart
  ) {
    errors.push('Warranty end cannot be before warranty start');
  }
  if (
    (check('purchaseDate') || check('invoiceDate')) &&
    values.purchaseDate && values.invoiceDate &&
    values.invoiceDate < values.purchaseDate
  ) {
    errors.push('Invoice date cannot be before purchase date');
  }

  if (errors.length) {
    throw badRequest(errors.join('; '));
  }
  return values;
}

module.exports = { badRequest, cleanAssetFields };
