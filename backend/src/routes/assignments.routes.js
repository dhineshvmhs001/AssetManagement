const express = require('express');
const assignmentsController = require('../controllers/assignments.controller');
const { auth } = require('../middleware/auth');
const { optionalAssignmentFiles } = require('../middleware/upload');

const router = express.Router();

router.use(auth);
router.get('/mine', assignmentsController.mine);
router.get('/options', assignmentsController.options);
router.get('/', assignmentsController.list);
router.post('/', optionalAssignmentFiles, assignmentsController.create);
router.get('/:code/files/:kind/:stored', assignmentsController.file);
router.post('/:code/ack', assignmentsController.acknowledge);
router.post('/:code/return', assignmentsController.returnOne);

module.exports = router;
