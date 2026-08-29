const multer = require('multer');
const { allowedFor } = require('../lib/uploads');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 16 },
  fileFilter(req, file, cb) {
    if (allowedFor(file.fieldname).has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error('That file type is not allowed');
    err.statusCode = 400;
    cb(err);
  },
});

const assetFiles = upload.fields([
  { name: 'documents', maxCount: 8 },
  { name: 'images', maxCount: 8 },
]);

function optionalAssetFiles(req, res, next) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('multipart/form-data')) {
    next();
    return;
  }
  assetFiles(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    err.statusCode = err.statusCode || 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Each file must be 8 MB or smaller';
    }
    // Multer says "Unexpected field" once a field goes past its maxCount,
    // which reads like a bug report rather than a limit.
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Up to 8 documents and 8 images per asset (extra "${err.field}" file)`;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      err.message = 'Too many files: 16 per asset at most';
    }
    next(err);
  });
}

const vendorFiles = upload.fields([{ name: 'documents', maxCount: 8 }]);

function optionalVendorFiles(req, res, next) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('multipart/form-data')) {
    next();
    return;
  }
  vendorFiles(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    err.statusCode = err.statusCode || 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Each file must be 8 MB or smaller';
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Up to 8 documents per vendor (extra "${err.field}" file)`;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      err.message = 'Too many files: 8 documents per vendor at most';
    }
    next(err);
  });
}

const employeeFiles = upload.fields([{ name: 'documents', maxCount: 8 }]);

function optionalEmployeeFiles(req, res, next) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('multipart/form-data')) {
    next();
    return;
  }
  employeeFiles(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    err.statusCode = err.statusCode || 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Each file must be 8 MB or smaller';
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Up to 8 documents per employee (extra "${err.field}" file)`;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      err.message = 'Too many files: 8 documents per employee at most';
    }
    next(err);
  });
}

const ticketFiles = upload.fields([{ name: 'attachments', maxCount: 8 }]);

function optionalTicketFiles(req, res, next) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('multipart/form-data')) {
    next();
    return;
  }
  ticketFiles(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    err.statusCode = err.statusCode || 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Each file must be 8 MB or smaller';
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Up to 8 attachments per ticket (extra "${err.field}" file)`;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      err.message = 'Too many files: 8 attachments per ticket at most';
    }
    next(err);
  });
}

const assignmentFiles = upload.fields([{ name: 'documents', maxCount: 8 }]);

function optionalAssignmentFiles(req, res, next) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('multipart/form-data')) {
    next();
    return;
  }
  assignmentFiles(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    err.statusCode = err.statusCode || 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Each file must be 8 MB or smaller';
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Up to 8 documents per assignment (extra "${err.field}" file)`;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      err.message = 'Too many files: 8 documents per assignment at most';
    }
    next(err);
  });
}

const maintenanceFiles = upload.fields([{ name: 'photos', maxCount: 8 }]);

function optionalMaintenanceFiles(req, res, next) {
  const type = String(req.headers['content-type'] || '');
  if (!type.includes('multipart/form-data')) {
    next();
    return;
  }
  maintenanceFiles(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    err.statusCode = err.statusCode || 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'Each file must be 8 MB or smaller';
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Up to 8 photos per check (extra "${err.field}" file)`;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      err.message = 'Too many files: 8 photos per check at most';
    }
    next(err);
  });
}

module.exports = {
  optionalAssetFiles,
  optionalVendorFiles,
  optionalEmployeeFiles,
  optionalTicketFiles,
  optionalAssignmentFiles,
  optionalMaintenanceFiles,
};
