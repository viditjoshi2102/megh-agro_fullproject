'use strict';

const isProd = process.env.NODE_ENV === 'production';

function errorHandler(err, req, res, next) {
  // Always log server-side with context (never exposed to client)
  if (!isProd || err.status >= 500) {
    process.stderr.write(`[ERROR] ${req.method} ${req.path} — ${err.message}\n${isProd ? '' : err.stack}\n`);
  }

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'A record with those details already exists.' });
  }

  // MySQL FK constraint
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(409).json({ success: false, message: 'Operation violates a data relationship constraint.' });
  }

  // Multer file errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large. Maximum size is 5 MB.' });
  }
  if (err.message && err.message.includes('Only .xlsx')) {
    return res.status(415).json({ success: false, message: err.message });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body too large.' });
  }

  // Application-set status codes (400, 403, 404, 409, etc.)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ success: false, message: err.message });
  }

  // Everything else → generic 500 (never leak internals in production)
  res.status(500).json({
    success: false,
    message: isProd ? 'An internal server error occurred.' : err.message,
  });
}

module.exports = { errorHandler };
