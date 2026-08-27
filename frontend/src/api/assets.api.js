import { get, post, postForm, patch, patchForm, getBlobUrl } from './client';

// Both create and update send JSON when there are no files and multipart
// when there are, so the two paths stay identical apart from the verb.
function sendWithFiles(fields, files, asJson, asForm) {
  const documents = files?.documents || [];
  const images = files?.images || [];
  if (!documents.length && !images.length) {
    return asJson(fields);
  }
  const form = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (key === 'documents' || key === 'images' || value === undefined || value === null || value === '') {
      return;
    }
    form.append(key, value);
  });
  documents.forEach((f) => form.append('documents', f));
  images.forEach((f) => form.append('images', f));
  return asForm(form);
}

function toQuery(params) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
  ).toString();
  return query ? `?${query}` : '';
}

export function listAssets(params = {}) {
  return get(`/assets${toQuery(params)}`);
}

// Same filters and sort as the list, minus paging — the export is the whole
// filtered set. Returns a blob URL because the endpoint sits behind auth.
export function exportAssets(params = {}) {
  const rest = { ...params };
  delete rest.page;
  delete rest.limit;
  return getBlobUrl(`/assets/export${toQuery(rest)}`);
}

export function getAssetHistory(code) {
  return get(`/assets/${encodeURIComponent(code)}/history`);
}

export function getAssetOptions() {
  return get('/assets/options');
}

export function getAsset(code) {
  return get(`/assets/${encodeURIComponent(code)}`);
}

export function getAssetQr(code) {
  return get(`/assets/${encodeURIComponent(code)}/qr`);
}

export function createAsset(fields, files = {}) {
  return sendWithFiles(
    fields,
    files,
    (body) => post('/assets', body),
    (form) => postForm('/assets', form),
  );
}

export function updateAsset(code, fields, files = {}) {
  const url = `/assets/${encodeURIComponent(code)}`;
  return sendWithFiles(
    fields,
    files,
    (body) => patch(url, body),
    (form) => patchForm(url, form),
  );
}

// `path` comes from asset.documents[].path / asset.images[].path.
export function getAssetFileUrl(path) {
  return getBlobUrl(path);
}

export function importAssets(csv) {
  return post('/assets/import', { csv });
}

export function getAssetTemplate() {
  return get('/assets/template');
}
