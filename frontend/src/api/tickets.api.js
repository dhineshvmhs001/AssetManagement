import { get, post, postForm, getBlobUrl } from './client';

function sendWithFiles(fields, files, asJson, asForm) {
  const attachments = files?.attachments || files?.documents || [];
  if (!attachments.length) {
    return asJson(fields);
  }
  const form = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (key === 'attachments' || key === 'documents' || value === undefined || value === null || value === '') {
      return;
    }
    form.append(key, Array.isArray(value) ? JSON.stringify(value) : value);
  });
  attachments.forEach((f) => form.append('attachments', f));
  return asForm(form);
}

function toQuery(params) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
  ).toString();
  return query ? `?${query}` : '';
}

export function listTickets(params = {}) {
  return get(`/tickets${toQuery(params)}`);
}

export function getTicketOptions() {
  return get('/tickets/options');
}

export function decideTicket(code, action) {
  return post(`/tickets/${encodeURIComponent(code)}/decision`, { action });
}

export function dispatchTicket(code) {
  return post(`/tickets/${encodeURIComponent(code)}/dispatch`);
}

export function getTicket(code) {
  return get(`/tickets/${encodeURIComponent(code)}`);
}

export function createTicket(fields, files = {}) {
  return sendWithFiles(
    fields,
    files,
    (body) => post('/tickets', body),
    (form) => postForm('/tickets', form),
  );
}

export function getTicketFileUrl(path) {
  return getBlobUrl(path);
}
