const express = require('express');
const vendorsController = require('../controllers/vendors.controller');
const { auth, allowRoles } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const { optionalVendorFiles } = require('../middleware/upload');

const router = express.Router();

router.use(auth);
router.use(allowRoles(ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM));
router.get('/', vendorsController.list);
router.get('/options', vendorsController.options);
router.post('/', optionalVendorFiles, vendorsController.create);
router.patch('/:code', optionalVendorFiles, vendorsController.update);
router.get('/:code/files/:kind/:stored', vendorsController.file);
router.get('/:code', vendorsController.getOne);

module.exports = router;
