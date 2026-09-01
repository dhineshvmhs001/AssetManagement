import { get, post, postForm, patch, patchForm, getBlobUrl } from './client';

function sendWithFiles(fields, files, asJson, asForm) {
  const documents = files?.documents || [];
  if (!documents.length) {
    return asJson(fields);
  }
  const form = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (key === 'documents' || value === undefined || value === null || value === '') {
      return;
    }
    form.append(key, value);
  });
  documents.forEach((f) => form.append('documents', f));
  return asForm(form);
}

function toQuery(params) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
  ).toString();
  return query ? `?${query}` : '';
}

export function listEmployees(params = {}) {
  return get(`/employees${toQuery(params)}`);
}

export function getEmployeeOptions() {
  return get('/employees/options');
}

export function getEmployee(code) {
  return get(`/employees/${encodeURIComponent(code)}`);
}

export function getEmployeeHistory(code) {
  return get(`/employees/${encodeURIComponent(code)}/history`);
}

export function createEmployee(fields, files = {}) {
  return sendWithFiles(
    fields,
    files,
    (body) => post('/employees', body),
    (form) => postForm('/employees', form),
  );
}

export function updateEmployee(code, fields, files = {}) {
  const url = `/employees/${encodeURIComponent(code)}`;
  return sendWithFiles(
    fields,
    files,
    (body) => patch(url, body),
    (form) => patchForm(url, form),
  );
}

export function getEmployeeFileUrl(path) {
  return getBlobUrl(path);
}

export function importEmployees(payload) {
  return post('/employees/import', payload);
}

export function getEmployeeTemplate() {
  return get('/employees/template');
}
