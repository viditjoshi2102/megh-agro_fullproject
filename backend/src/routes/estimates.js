const router = require('express').Router();
const ctrl   = require('../controllers/estimateController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/',             ctrl.list);
router.get('/:id/download', ctrl.download);

module.exports = router;
