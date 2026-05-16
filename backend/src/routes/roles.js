const router = require('express').Router();
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const ctrl = require('../controllers/roleController');

router.use(authenticate);

router.get('/',                authorize(ROLES.SUPER_ADMIN), ctrl.list);
router.get('/permissions',     authorize(ROLES.SUPER_ADMIN), ctrl.allPermissions);
router.get('/:id',             authorize(ROLES.SUPER_ADMIN), ctrl.getOne);
router.post('/',               authorize(ROLES.SUPER_ADMIN), ctrl.create);
router.put('/:id',             authorize(ROLES.SUPER_ADMIN), ctrl.update);
router.delete('/:id',          authorize(ROLES.SUPER_ADMIN), ctrl.remove);
router.put('/:id/permissions', authorize(ROLES.SUPER_ADMIN), ctrl.setPermissions);

module.exports = router;
