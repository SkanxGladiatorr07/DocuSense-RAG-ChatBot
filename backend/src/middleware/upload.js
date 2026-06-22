/**
 * @file middleware/upload.js
 * @description Reusable Multer upload middleware factory.
 *
 *   Enforces:
 *   • Allowed file types : PDF, DOCX, TXT
 *   • Hard size cap       : 10 MB per file
 *   • Storage destination : <project-root>/backend/uploads/
 *
 *   Usage (single file, field name "document"):
 *     const { uploadSingle } = require('../middleware/upload');
 *     router.post('/upload', uploadSingle('document'), controller);
 *
 *   Usage (up to 5 files, field name "documents"):
 *     const { uploadArray } = require('../middleware/upload');
 *     router.post('/upload', uploadArray('documents', 5), controller);
 *
 *   Multer errors (LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE, etc.) are
 *   converted into AppError instances by the handleMulterError wrapper
 *   so they flow through the global errorHandler automatically.
 */

const path   = require('path');
const multer = require('multer');
const AppError = require('../utils/AppError');

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum accepted file size in bytes (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Accepted MIME types mapped to their canonical extension label.
 * Both the MIME type AND the extension are checked so spoofed content-type
 * headers do not bypass validation.
 */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',                                                       // PDF
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'text/plain',                                                            // TXT
]);

/** Allowed file extensions (lower-cased, including the leading dot). */
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

// ── Storage Engine ────────────────────────────────────────────────────────────

/**
 * Disk storage — saves files to backend/uploads/ with a collision-safe name:
 *   <timestamp>-<originalname>
 * e.g. 1718000000000-company-policy.pdf
 */
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    // Resolve relative to this file so the path is correct regardless of CWD
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    cb(null, uploadsDir);
  },

  filename(_req, file, cb) {
    const timestamp  = Date.now();
    // Sanitise original name: replace whitespace with underscores
    const safeName   = file.originalname.replace(/\s+/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  },
});

// ── File Filter ───────────────────────────────────────────────────────────────

/**
 * Multer file-filter callback.
 * Rejects files whose MIME type OR extension is not in the allow-lists.
 *
 * @param {import('express').Request} _req
 * @param {Express.Multer.File}       file
 * @param {multer.FileFilterCallback} cb
 */
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
  const extOk  = ALLOWED_EXTENSIONS.has(ext);

  if (mimeOk && extOk) {
    return cb(null, true); // Accept
  }

  // Build a readable error message
  const allowedList = [...ALLOWED_EXTENSIONS].join(', ');
  cb(
    AppError.badRequest(
      `Unsupported file type "${ext || file.mimetype}". ` +
      `Only ${allowedList} files are accepted.`
    )
  );
};

// ── Multer Instance ───────────────────────────────────────────────────────────

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

// ── Error Wrapper ─────────────────────────────────────────────────────────────

/**
 * Wraps any multer middleware so that MulterError instances (e.g. file too
 * large, unexpected field) are converted to AppError and forwarded to the
 * global error handler instead of crashing the request.
 *
 * @param {Function} multerMiddleware - A bound multer handler (single/array/fields)
 * @returns {import('express').RequestHandler}
 */
const handleMulterError = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next(); // No error — proceed normally

    if (err instanceof multer.MulterError) {
      // Map Multer-specific error codes to friendly messages
      switch (err.code) {
        case 'LIMIT_FILE_SIZE':
          return next(
            AppError.badRequest(
              `File is too large. Maximum allowed size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`
            )
          );
        case 'LIMIT_FILE_COUNT':
          return next(AppError.badRequest('Too many files uploaded at once.'));
        case 'LIMIT_UNEXPECTED_FILE':
          return next(
            AppError.badRequest(`Unexpected field name "${err.field}" in the upload request.`)
          );
        default:
          return next(AppError.badRequest(`Upload error: ${err.message}`));
      }
    }

    // AppError thrown by fileFilter or any other error — pass through as-is
    next(err);
  });
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Middleware for a single-file upload.
 *
 * @param {string} fieldName - The multipart form field name (default: 'document')
 * @returns {import('express').RequestHandler}
 */
const uploadSingle = (fieldName = 'document') =>
  handleMulterError(multerUpload.single(fieldName));

/**
 * Middleware for multiple files under the same field.
 *
 * @param {string} fieldName - The multipart form field name (default: 'documents')
 * @param {number} maxCount  - Maximum number of files (default: 10)
 * @returns {import('express').RequestHandler}
 */
const uploadArray = (fieldName = 'documents', maxCount = 10) =>
  handleMulterError(multerUpload.array(fieldName, maxCount));

/**
 * Raw multer instance — exposed for advanced use cases (e.g. `.fields()`).
 * Callers are responsible for wrapping with `handleMulterError` themselves.
 */
const rawUpload = multerUpload;

module.exports = {
  uploadSingle,
  uploadArray,
  handleMulterError,
  rawUpload,
  // Constants exported so controllers/tests can reference them
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
};
