const express = require('express');
const { getAuditLogs } = require('../controllers/auditController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.get('/', authMiddleware, requireRole('HR'), getAuditLogs);

module.exports = router;
