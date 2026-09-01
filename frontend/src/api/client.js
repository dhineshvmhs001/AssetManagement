import { getToken, clearSession } from '../auth/session';
import { trackRequestEnd, trackRequestStart } from '../ui/loading';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';

function shouldTrack(path, silent) {
  if (silent) {
    return false;
  }
  return path !== '/auth/me' && !path.startsWith('/auth/me?');
}

async function request(path, options = {}) {
  const { silent, ...fetchOpts } = options;
  const headers = { ...(fetchOpts.headers || {}) };
  const token = getToken();
  const track = shouldTrack(path, silent) ? trackRequestStart() : 0;

  if (fetchOpts.body && !headers['Content-Type'] && !(fetchOpts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });
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
  } finally {
    trackRequestEnd(track);
  }
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

export async function downloadFile(path) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearSession();
      window.dispatchEvent(new Event('asset-logout'));
    }
    return { ok: false, error: data.error || 'Could not download' };
  }
  // The server caps large exports; it says so in a header rather than handing
  // back a short file that looks complete.
  const limit = Number(res.headers.get('X-Export-Limit')) || 0;
  return {
    ok: true,
    url: URL.createObjectURL(await res.blob()),
    truncated: res.headers.get('X-Export-Truncated') === 'true',
    limit,
  };
}
