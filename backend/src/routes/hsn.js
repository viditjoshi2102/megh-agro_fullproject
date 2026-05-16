const router = require('express').Router();
const ctrl   = require('../controllers/hsnController');
const bulk   = require('../controllers/bulkUploadController');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);
router.get(   '/bulk-template', authorize(ROLES.SUPER_ADMIN), bulk.hsnTemplate);
router.post(  '/bulk-upload',   authorize(ROLES.SUPER_ADMIN), upload.single('file'), bulk.hsnUpload);
router.get(   '/',              ctrl.list);
router.get(   '/code/:code',    ctrl.getByCode);
router.post(  '/',              authorize(ROLES.SUPER_ADMIN), ctrl.create);
router.put(   '/:id',           authorize(ROLES.SUPER_ADMIN), ctrl.update);
router.delete('/:id',           authorize(ROLES.SUPER_ADMIN), ctrl.remove);

module.exports = router;
