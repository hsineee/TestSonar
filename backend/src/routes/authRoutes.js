const express = require('express');
const { login, verifyMfa, getMe } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.post('/verify-mfa', verifyMfa);
router.get('/me', authMiddleware, getMe);

module.exports = router;
