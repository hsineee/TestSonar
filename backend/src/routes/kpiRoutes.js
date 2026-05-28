const express = require('express');
const { getKpis, createKpi } = require('../controllers/kpiController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.get('/', authMiddleware, getKpis);
router.post('/', authMiddleware, requireRole('MANAGER'), createKpi);

module.exports = router;
