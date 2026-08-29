const express = require('express');
const ticketsController = require('../controllers/tickets.controller');
const { auth } = require('../middleware/auth');
const { optionalTicketFiles } = require('../middleware/upload');

const router = express.Router();

router.get('/decide', ticketsController.decideForm);
router.post('/decide', ticketsController.decideSubmit);
router.use(auth);
router.get('/', ticketsController.list);
router.get('/options', ticketsController.options);
router.post('/', optionalTicketFiles, ticketsController.create);
router.get('/:code/files/:kind/:stored', ticketsController.file);
router.get('/:code', ticketsController.getOne);
router.post('/:code/decision', ticketsController.decideInApp);
router.post('/:code/dispatch', ticketsController.dispatchToTeam);

module.exports = router;
