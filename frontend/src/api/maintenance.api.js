import { get, post, postForm } from './client';

export function getMaintenanceOptions() {
  return get('/maintenance/options');
}

export function listPrecheckQueue() {
  return get('/maintenance/queue');
}

export function listRepairs() {
  return get('/maintenance/repairs');
}

export function listRecentChecks() {
  return get('/maintenance/recent');
}

export function submitPrecheck(code, fields, photos = []) {
  if (!photos.length) {
    return post(`/maintenance/${encodeURIComponent(code)}/check`, fields);
  }
  const form = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    form.append(key, typeof value === 'boolean' ? String(value) : value);
  });
  photos.forEach((file) => form.append('photos', file));
  return postForm(`/maintenance/${encodeURIComponent(code)}/check`, form);
}

export function completeRepair(code, fields) {
  return post(`/maintenance/${encodeURIComponent(code)}/complete-repair`, fields);
}
