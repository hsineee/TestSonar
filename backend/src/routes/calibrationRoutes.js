const express = require('express');
const calibrationController = require('../controllers/calibrationController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/standards', requireRole(['HR', 'MANAGER']), calibrationController.getStandards);

router.post('/standards', requireRole(['HR', 'MANAGER']), calibrationController.createStandard);

router.get('/dashboard', requireRole('MANAGER'), calibrationController.getDashboard);

router.delete('/standards/:id', requireRole(['HR', 'MANAGER']), calibrationController.deleteStandard);

module.exports = router;