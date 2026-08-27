const { PRODUCTION_MODE } = require('../config/env');
const { CATEGORIES } = require('./assetStatus');

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

const CORE_FIELDS = [
  { key: 'employeeId', label: 'Employee' },
  { key: 'category', label: 'Asset category' },
];

const ALL_FIELDS = [
  ...CORE_FIELDS,
  { key: 'quantity', label: 'Quantity' },
  { key: 'priority', label: 'Priority' },
  { key: 'needDate', label: 'Need date' },
  { key: 'attachments', label: 'Attachments', file: true },
];

function requiredFieldDefs() {
  return PRODUCTION_MODE ? ALL_FIELDS : CORE_FIELDS;
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
  CATEGORIES,
  PRIORITIES,
  CORE_FIELDS,
  ALL_FIELDS,
  requiredFieldDefs,
  requiredFieldKeys,
  missingRequired,
};
