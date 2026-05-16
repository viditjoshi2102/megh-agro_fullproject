const router = require('express').Router();
const ctrl   = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login',           ctrl.login);
router.post('/refresh',         ctrl.refresh);
router.post('/logout',          authenticate, ctrl.logout);
router.get( '/me',              authenticate, ctrl.me);
router.post('/change-password', authenticate, ctrl.changePassword);

module.exports = router;
