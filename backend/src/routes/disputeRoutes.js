const express = require('express');
const { fileDispute, getPendingDisputes, resolveDispute } = require('../controllers/disputeController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.post('/', authMiddleware, requireRole('EMPLOYEE'), fileDispute);
router.get('/', authMiddleware, requireRole('MANAGER'), getPendingDisputes);
router.patch('/:id/resolve', authMiddleware, requireRole('MANAGER'), resolveDispute);

module.exports = router;
