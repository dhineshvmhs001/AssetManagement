const { PRODUCTION_MODE } = require('../config/env');

const CORE_FIELDS = [
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'serialNumber', keys: ['serialNumber', 'serial_number'], label: 'Serial number' },
];

const ALL_FIELDS = [
  ...CORE_FIELDS,
  { key: 'model', label: 'Model' },
  { key: 'assetType', keys: ['assetType', 'asset_type'], label: 'Asset type' },
  { key: 'purchaseDate', keys: ['purchaseDate', 'purchase_date'], label: 'Purchase date' },
  { key: 'purchaseCost', keys: ['purchaseCost', 'purchase_cost'], label: 'Purchase cost' },
  { key: 'invoiceNumber', keys: ['invoiceNumber', 'invoice_number'], label: 'Invoice number' },
  { key: 'invoiceDate', keys: ['invoiceDate', 'invoice_date'], label: 'Invoice date' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'location', label: 'Location' },
  { key: 'condition', label: 'Condition' },
  { key: 'warrantyStart', keys: ['warrantyStart', 'warranty_start'], label: 'Warranty start' },
  { key: 'warrantyEnd', keys: ['warrantyEnd', 'warranty_end'], label: 'Warranty end' },
  { key: 'documents', label: 'Documents', file: true },
  { key: 'images', label: 'Images', file: true },
];

function requiredFieldDefs() {
  return PRODUCTION_MODE ? ALL_FIELDS : CORE_FIELDS;
}

function fieldValue(fields, def) {
  const keys = def.keys || [def.key];
  for (const key of keys) {
    const value = fields?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function missingRequired(fields, files = {}, { skipFiles = false } = {}) {
  const missing = [];
  for (const def of requiredFieldDefs()) {
    if (def.file) {
      if (skipFiles) {
        continue;
      }
      if (!(files[def.key] || []).length) {
        missing.push(def.label);
      }
      continue;
    }
    if (!fieldValue(fields, def)) {
      missing.push(def.label);
    }
  }
  return missing;
}

function requiredFieldKeys() {
  return requiredFieldDefs().map((def) => def.key);
}

// The snake_case column name each field uses in the bulk-import CSV.
function csvHeaderFor(def) {
  const snake = (def.keys || []).find((key) => key.includes('_'));
  return snake || def.key;
}

// CSV has no columns for documents/images, so file fields are left out.
function requiredCsvHeaders() {
  return requiredFieldDefs().filter((def) => !def.file).map(csvHeaderFor);
}

module.exports = {
  PRODUCTION_MODE,
  CORE_FIELDS,
  ALL_FIELDS,
  requiredFieldDefs,
  requiredFieldKeys,
  requiredCsvHeaders,
  missingRequired,
};
