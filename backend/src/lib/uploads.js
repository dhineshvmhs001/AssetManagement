const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '../../uploads/assets');
const VENDOR_ROOT = path.join(__dirname, '../../uploads/vendors');
const EMPLOYEE_ROOT = path.join(__dirname, '../../uploads/employees');
const TICKET_ROOT = path.join(__dirname, '../../uploads/tickets');
const MAINTENANCE_ROOT = path.join(__dirname, '../../uploads/maintenance');
const ASSIGNMENT_ROOT = path.join(__dirname, '../../uploads/assignments');

const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const EXT = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

function allowedFor(field) {
  return field === 'images' || field === 'photos' ? IMAGE_TYPES : DOCUMENT_TYPES;
}

function saveUploads(assetId, files = {}) {
  const documents = Array.isArray(files.documents) ? files.documents : [];
  const images = Array.isArray(files.images) ? files.images : [];
  return {
    documents: writeKind(ROOT, assetId, 'documents', documents),
    images: writeKind(ROOT, assetId, 'images', images),
  };
}

function saveVendorUploads(vendorId, files = {}) {
  const documents = Array.isArray(files.documents) ? files.documents : [];
  return {
    documents: writeKind(VENDOR_ROOT, vendorId, 'documents', documents),
  };
}

function saveEmployeeUploads(employeeId, files = {}) {
  const documents = Array.isArray(files.documents) ? files.documents : [];
  return {
    documents: writeKind(EMPLOYEE_ROOT, employeeId, 'documents', documents),
  };
}

function saveTicketUploads(ticketId, files = {}) {
  const attachments = Array.isArray(files.attachments) ? files.attachments : [];
  return {
    attachments: writeKind(TICKET_ROOT, ticketId, 'attachments', attachments),
  };
}

function saveMaintenanceUploads(checkId, files = {}) {
  const photos = Array.isArray(files.photos) ? files.photos : [];
  return {
    photos: writeKind(MAINTENANCE_ROOT, checkId, 'photos', photos),
  };
}

function saveAssignmentUploads(assignmentId, files = {}) {
  const documents = Array.isArray(files.documents) ? files.documents : [];
  return {
    documents: writeKind(ASSIGNMENT_ROOT, assignmentId, 'documents', documents),
  };
}

function writeKind(root, entityId, kind, files) {
  if (!files.length) {
    return [];
  }
  const dir = path.join(root, entityId, kind);
  fs.mkdirSync(dir, { recursive: true });
  return files.map((file) => {
    const ext = EXT[file.mimetype] || path.extname(file.originalname || '').toLowerCase() || '';
    const stored = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(dir, stored), file.buffer);
    return {
      name: file.originalname,
      stored,
      mime: file.mimetype,
      size: file.size,
    };
  });
}

// Best effort: used to clean up files already on disk when the INSERT fails.
function removeAssetUploads(assetId) {
  try {
    fs.rmSync(path.join(ROOT, assetId), { recursive: true, force: true });
  } catch {
    /* nothing more we can do */
  }
}

function removeVendorUploads(vendorId) {
  try {
    fs.rmSync(path.join(VENDOR_ROOT, vendorId), { recursive: true, force: true });
  } catch {
    /* nothing more we can do */
  }
}

function removeEmployeeUploads(employeeId) {
  try {
    fs.rmSync(path.join(EMPLOYEE_ROOT, employeeId), { recursive: true, force: true });
  } catch {
    /* nothing more we can do */
  }
}

function removeTicketUploads(ticketId) {
  try {
    fs.rmSync(path.join(TICKET_ROOT, ticketId), { recursive: true, force: true });
  } catch {
    /* nothing more we can do */
  }
}

function removeMaintenanceUploads(checkId) {
  try {
    fs.rmSync(path.join(MAINTENANCE_ROOT, checkId), { recursive: true, force: true });
  } catch {
    /* nothing more we can do */
  }
}

function removeAssignmentUploads(assignmentId) {
  try {
    fs.rmSync(path.join(ASSIGNMENT_ROOT, assignmentId), { recursive: true, force: true });
  } catch {
    /* nothing more we can do */
  }
}

function parseStored(raw) {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return [{ name: String(raw), stored: null, mime: null, size: null }];
  }
  return [];
}

// `path` is an API path, not a plain URL: it needs the Authorization header,
// so the browser has to fetch it through the api client rather than put it
// straight into an <img src>.
function publicFiles(assetId, documentsRaw, imagesRaw) {
  const withPath = (kind) => (file) => ({
    ...file,
    path: file.stored ? `/assets/${assetId}/files/${kind}/${file.stored}` : null,
  });
  return {
    documents: parseStored(documentsRaw).map(withPath('documents')),
    images: parseStored(imagesRaw).map(withPath('images')),
  };
}

function publicVendorFiles(vendorId, documentsRaw) {
  return {
    documents: parseStored(documentsRaw).map((file) => ({
      ...file,
      path: file.stored ? `/vendors/${vendorId}/files/documents/${file.stored}` : null,
    })),
  };
}

function publicEmployeeFiles(employeeId, documentsRaw) {
  return {
    documents: parseStored(documentsRaw).map((file) => ({
      ...file,
      path: file.stored ? `/employees/${employeeId}/files/documents/${file.stored}` : null,
    })),
  };
}

function publicTicketFiles(ticketId, attachmentsRaw) {
  return {
    attachments: parseStored(attachmentsRaw).map((file) => ({
      ...file,
      path: file.stored ? `/tickets/${ticketId}/files/attachments/${file.stored}` : null,
    })),
  };
}

function publicMaintenanceFiles(checkId, photosRaw) {
  return {
    photos: parseStored(photosRaw).map((file) => ({
      ...file,
      path: file.stored ? `/maintenance/checks/${checkId}/files/photos/${file.stored}` : null,
    })),
  };
}

function publicAssignmentFiles(assignmentId, documentsRaw) {
  return {
    documents: parseStored(documentsRaw).map((file) => ({
      ...file,
      path: file.stored ? `/assignments/${assignmentId}/files/documents/${file.stored}` : null,
    })),
  };
}

module.exports = {
  ROOT,
  VENDOR_ROOT,
  EMPLOYEE_ROOT,
  TICKET_ROOT,
  MAINTENANCE_ROOT,
  ASSIGNMENT_ROOT,
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  allowedFor,
  saveUploads,
  saveVendorUploads,
  saveEmployeeUploads,
  saveTicketUploads,
  saveMaintenanceUploads,
  saveAssignmentUploads,
  removeAssetUploads,
  removeVendorUploads,
  removeEmployeeUploads,
  removeTicketUploads,
  removeMaintenanceUploads,
  removeAssignmentUploads,
  parseStored,
  publicFiles,
  publicVendorFiles,
  publicEmployeeFiles,
  publicTicketFiles,
  publicMaintenanceFiles,
  publicAssignmentFiles,
};
