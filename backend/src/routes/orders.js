const router = require('express').Router();
const ctrl   = require('../controllers/orderController');
const invCtrl = require('../controllers/invoiceController');
const estCtrl = require('../controllers/estimateController');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

router.use(authenticate);
router.get( '/',              ctrl.list);
router.post('/',              ctrl.create);
router.get( '/:id',           ctrl.getOne);
router.put( '/:id',           ctrl.update);
router.patch('/:id/status',   authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), ctrl.updateStatus);

// PI and Estimate generation from order
router.post('/:orderId/generate-pi',       invCtrl.generate);
router.post('/:orderId/generate-estimate', estCtrl.generate);

module.exports = router;
