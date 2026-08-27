const { PRODUCTION_MODE } = require('../config/env');

const DEPARTMENTS = ['Sales', 'Operations', 'Support', 'HR'];

const CORE_FIELDS = [
  { key: 'name', label: 'Name' },
];

const ALL_FIELDS = [
  ...CORE_FIELDS,
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'joiningDate', label: 'Joining date' },
  { key: 'managerId', label: 'Manager' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'documents', label: 'Documents', file: true },
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
  DEPARTMENTS,
  CORE_FIELDS,
  ALL_FIELDS,
  requiredFieldDefs,
  requiredFieldKeys,
  missingRequired,
};
