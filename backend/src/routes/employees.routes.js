const express = require('express');
const employeesController = require('../controllers/employees.controller');
const { auth } = require('../middleware/auth');
const { importLimit } = require('../middleware/rateLimit');
const { optionalEmployeeFiles } = require('../middleware/upload');

const router = express.Router();

router.use(auth);
router.get('/', employeesController.list);
router.get('/options', employeesController.options);
router.get('/template', employeesController.template);
router.post('/import', importLimit, employeesController.importCsv);
router.post('/', optionalEmployeeFiles, employeesController.create);
router.patch('/:code', optionalEmployeeFiles, employeesController.update);
router.get('/:code/history', employeesController.history);
router.get('/:code/files/:kind/:stored', employeesController.file);
router.get('/:code', employeesController.getOne);

module.exports = router;
