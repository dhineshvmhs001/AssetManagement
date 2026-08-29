import { get, post, postForm, getBlobUrl } from './client';

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
    form.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
  });
  documents.forEach((f) => form.append('documents', f));
  return asForm(form);
}

function toQuery(params) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value || value === 0)),
  ).toString();
  return query ? `?${query}` : '';
}

export function listAssignments(params = {}) {
  return get(`/assignments${toQuery(params)}`);
}

export function listMyAssignments() {
  return get('/assignments/mine');
}

export function getAssignmentOptions() {
  return get('/assignments/options');
}

export function createAssignment(fields, files = {}) {
  return sendWithFiles(
    fields,
    files,
    (body) => post('/assignments', body),
    (form) => postForm('/assignments', form),
  );
}

export function returnAssignment(code, fields) {
  return post(`/assignments/${encodeURIComponent(code)}/return`, fields);
}

export function getAssignmentFileUrl(path) {
  return getBlobUrl(path);
}
