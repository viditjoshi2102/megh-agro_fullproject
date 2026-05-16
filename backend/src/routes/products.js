const router = require('express').Router();
const ctrl   = require('../controllers/productController');
const bulk   = require('../controllers/bulkUploadController');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(authenticate);
router.get(   '/dropdown',              ctrl.dropdown);
router.get(   '/categories',            ctrl.listCategories);
router.post(  '/categories',            authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), ctrl.createCategory);
router.get(   '/bulk-template',         authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), bulk.productTemplate);
router.post(  '/bulk-upload',           authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), upload.single('file'), bulk.productUpload);
router.get(   '/',                      ctrl.list);
router.get(   '/:id',                   ctrl.getOne);
router.post(  '/',                      authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), ctrl.create);
router.put(   '/:id',                   authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), ctrl.update);
router.delete('/:id',                   authorize(ROLES.SUPER_ADMIN), ctrl.remove);

module.exports = router;
