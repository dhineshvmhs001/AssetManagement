import { getToken, clearSession } from '../auth/session';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();

  if (options.body && !headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== '/auth/login') {
    clearSession();
    window.dispatchEvent(new Event('asset-logout'));
  }

  if (!data.ok && !data.error) {
    data.ok = false;
    data.error = res.statusText || 'Could not save';
  }

  return data;
}

export function get(path) {
  return request(path);
}

export function post(path, body) {
  return request(path, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}

export function postForm(path, form) {
  return request(path, {
    method: 'POST',
    body: form,
  });
}

export function patch(path, body) {
  return request(path, {
    method: 'PATCH',
    body: JSON.stringify(body || {}),
  });
}

export function patchForm(path, form) {
  return request(path, {
    method: 'PATCH',
    body: form,
  });
}

// Uploaded files sit behind auth, so they cannot go straight into an <img
// src>. Fetch with the token and hand back a blob URL the page can render.
// The caller owns the URL and must revokeObjectURL it.
export async function getBlobUrl(path) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      window.dispatchEvent(new Event('asset-logout'));
    }
    return null;
  }
  return URL.createObjectURL(await res.blob());
}
