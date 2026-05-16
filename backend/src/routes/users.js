const router = require('express').Router();
const ctrl   = require('../controllers/userController');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

router.use(authenticate);
router.get(  '/dropdown',           ctrl.dropdown);
router.get(  '/',                   authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), ctrl.list);
router.get(  '/:id',                authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), ctrl.getOne);
router.post( '/',                   authorize(ROLES.SUPER_ADMIN), ctrl.create);
router.put(  '/:id',                authorize(ROLES.SUPER_ADMIN), ctrl.update);
router.post( '/:id/reset-password', authorize(ROLES.SUPER_ADMIN), ctrl.resetPassword);

module.exports = router;
