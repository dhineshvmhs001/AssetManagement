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

export function listVendors(params = {}) {
  return get(`/vendors${toQuery(params)}`);
}

export function getVendorOptions() {
  return get('/vendors/options');
}

export function getVendor(code) {
  return get(`/vendors/${encodeURIComponent(code)}`);
}

export function createVendor(fields, files = {}) {
  return sendWithFiles(
    fields,
    files,
    (body) => post('/vendors', body),
    (form) => postForm('/vendors', form),
  );
}

export function updateVendor(code, fields, files = {}) {
  const url = `/vendors/${encodeURIComponent(code)}`;
  return sendWithFiles(
    fields,
    files,
    (body) => patch(url, body),
    (form) => patchForm(url, form),
  );
}

export function getVendorFileUrl(path) {
  return getBlobUrl(path);
}
