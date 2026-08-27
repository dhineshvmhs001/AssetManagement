const express = require('express');
const employeesController = require('../controllers/employees.controller');
const { auth } = require('../middleware/auth');
const { optionalEmployeeFiles } = require('../middleware/upload');

const router = express.Router();

router.use(auth);
router.get('/', employeesController.list);
router.get('/options', employeesController.options);
router.post('/', optionalEmployeeFiles, employeesController.create);
router.patch('/:code', optionalEmployeeFiles, employeesController.update);
router.get('/:code/files/:kind/:stored', employeesController.file);
router.get('/:code', employeesController.getOne);

module.exports = router;
