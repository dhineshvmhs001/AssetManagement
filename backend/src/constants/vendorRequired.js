const { PRODUCTION_MODE } = require('../config/env');

const CORE_FIELDS = [
  { key: 'name', label: 'Vendor / Supplier name' },
];

const ALL_FIELDS = [
  ...CORE_FIELDS,
  { key: 'contact', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'branch', label: 'Branch' },
  { key: 'ifscCode', label: 'IFSC code' },
  { key: 'accountHolderName', label: 'Account holder name' },
  { key: 'documents', label: 'Documents', file: true },
];

function requiredFieldDefs() {
  if (PRODUCTION_MODE) {
    return ALL_FIELDS;
  }
  return ALL_FIELDS.filter((def) => !def.file);
}

function fieldValue(fields, def) {
  const value = fields?.[def.key];
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    return String(value).trim();
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

module.exports = {
  PRODUCTION_MODE,
  CORE_FIELDS,
  ALL_FIELDS,
  requiredFieldDefs,
  requiredFieldKeys,
  missingRequired,
};
