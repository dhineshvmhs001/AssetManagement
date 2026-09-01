import { downloadFile, get } from './client';

function toQuery(params) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
  ).toString();
  return query ? `?${query}` : '';
}

export function listActivity(params = {}) {
  return get(`/activity${toQuery(params)}`);
}

export function getActivitySummary() {
  return get('/activity/summary');
}

export function exportActivity(params = {}) {
  const rest = { ...params };
  delete rest.page;
  delete rest.limit;
  return downloadFile(`/activity/export${toQuery(rest)}`);
}
