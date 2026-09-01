const express = require('express');
const reportsController = require('../controllers/reports.controller');
const { auth, allowRoles } = require('../middleware/auth');
const { exportLimit } = require('../middleware/rateLimit');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(auth);
router.use(allowRoles(ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM, ROLES.HR));
router.get('/', reportsController.catalog);
router.get('/:group/:slug/export', exportLimit, reportsController.exportCsv);
router.get('/:group/:slug', reportsController.run);

module.exports = router;
