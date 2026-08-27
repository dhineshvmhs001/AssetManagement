const express = require('express');
const authController = require('../controllers/auth.controller');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', authController.login);
router.get('/me', auth, authController.me);
router.post('/logout', auth, authController.logout);

module.exports = router;
