const express = require('express');
const assetsController = require('../controllers/assets.controller');
const { auth, allowRoles } = require('../middleware/auth');
const { ROLES } = require('../constants/roles');
const { exportLimit, importLimit } = require('../middleware/rateLimit');
const { optionalAssetFiles } = require('../middleware/upload');

const router = express.Router();

router.use(auth);
router.use(allowRoles(ROLES.ADMIN, ROLES.ASSET_MANAGER, ROLES.ASSET_TEAM));
router.get('/', assetsController.list);
router.get('/options', assetsController.options);
router.get('/template', assetsController.template);
// Must stay above '/:code' or "export" is read as an asset code.
router.get('/export', exportLimit, assetsController.exportCsv);
router.post('/', optionalAssetFiles, assetsController.create);
router.post('/import', importLimit, assetsController.importCsv);
router.patch('/:code', optionalAssetFiles, assetsController.update);
router.get('/:code/qr', assetsController.qr);
router.get('/:code/history', assetsController.history);
router.get('/:code/files/:kind/:stored', assetsController.file);
router.get('/:code', assetsController.getOne);

module.exports = router;
