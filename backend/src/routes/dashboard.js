const router = require('express').Router();
const ctrl   = require('../controllers/dashboardController');
const { authenticate, authorize, ROLES } = require('../middleware/auth');

router.use(authenticate);
router.get('/owner',       authorize(ROLES.SUPER_ADMIN), ctrl.ownerDashboard);
router.get('/admin',       authorize(ROLES.SUPER_ADMIN, ROLES.SALES_ADMIN), ctrl.adminDashboard);
router.get('/salesperson', ctrl.salespersonDashboard);
router.get('/audit-logs',  authorize(ROLES.SUPER_ADMIN), ctrl.auditLogs);

module.exports = router;
