import { downloadFile, get } from './client';

function toQuery(params) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value || value === 0)),
  ).toString();
  return query ? `?${query}` : '';
}

export function getReportCatalog() {
  return get('/reports');
}

export function runReport(group, slug, params = {}) {
  return get(`/reports/${encodeURIComponent(group)}/${encodeURIComponent(slug)}${toQuery(params)}`);
}

export function exportReport(group, slug, params = {}) {
  const rest = { ...params };
  delete rest.page;
  delete rest.limit;
  return downloadFile(`/reports/${encodeURIComponent(group)}/${encodeURIComponent(slug)}/export${toQuery(rest)}`);
}
