const express = require('express');
const { getSummary, getDrillDown } = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

// Only MANAGERs can access the dashboard
router.get('/summary', authMiddleware, requireRole('MANAGER'), getSummary);
router.get('/drilldown/:managerId', authMiddleware, requireRole('MANAGER'), getDrillDown);

module.exports = router;
