const multer = require('multer');

const storage = multer.memoryStorage();

const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
]);

const fileFilter = (req, file, cb) => {
  const ext = file.originalname.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Only .xlsx and .xls files are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

module.exports = { upload };
