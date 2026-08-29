const express = require('express');
const maintenanceController = require('../controllers/maintenance.controller');
const { auth, allowRoles } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const { optionalMaintenanceFiles } = require('../middleware/upload');

const router = express.Router();

router.use(auth);
router.use(allowRoles(ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM));
router.get('/queue', maintenanceController.queue);
router.get('/repairs', maintenanceController.repairs);
router.get('/recent', maintenanceController.recent);
router.get('/options', maintenanceController.options);
router.get('/checks/:id/files/:kind/:stored', maintenanceController.file);
router.post('/:code/check', optionalMaintenanceFiles, maintenanceController.check);
router.post('/:code/complete-repair', maintenanceController.completeRepair);

module.exports = router;
