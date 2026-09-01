const express = require('express');
const activityController = require('../controllers/activity.controller');
const { auth, allowRoles } = require('../middleware/auth');
const { exportLimit } = require('../middleware/rateLimit');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(auth);
router.use(allowRoles(ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM));
router.get('/summary', activityController.summary);
router.get('/export', exportLimit, activityController.exportCsv);
router.get('/', activityController.list);

module.exports = router;
