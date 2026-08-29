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

// Bulk import CSV. Names and order must match this list exactly.
const CSV_HEADERS = [
  'employeeid',
  'employeename',
  'department',
  'designation',
  'employeeemail',
  'contactnumber',
  'joiningdate',
  'location',
  'status',
  'manageremail',
  'managername',
];

const EMPLOYEE_ID_PATTERN = /^MHS[0-9]+$/;
const EMPLOYEE_ID_HINT = 'MHS followed by numbers, like MHS101 (no spaces or dashes)';

function parseEmployeeCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) {
    return { error: 'Employee ID is required' };
  }
  if (!EMPLOYEE_ID_PATTERN.test(code)) {
    return { error: `Employee ID must be ${EMPLOYEE_ID_HINT}` };
  }
  return { code };
}

module.exports = {
  PRODUCTION_MODE,
  DEPARTMENTS,
  CORE_FIELDS,
  ALL_FIELDS,
  CSV_HEADERS,
  EMPLOYEE_ID_HINT,
  requiredFieldDefs,
  requiredFieldKeys,
  missingRequired,
  parseEmployeeCode,
};
