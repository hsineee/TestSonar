const express = require('express');
const dailyOutputController = require('../controllers/dailyOutputController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/tags', dailyOutputController.getTags);
router.post('/logs', requireRole('EMPLOYEE'), dailyOutputController.createLog);
router.get('/logs', requireRole('EMPLOYEE'), dailyOutputController.listMyLogs);
router.delete('/logs/:id', requireRole('EMPLOYEE'), dailyOutputController.deleteMyLog);
router.get('/weekly-report', requireRole('EMPLOYEE'), dailyOutputController.getMyWeeklyReport);
router.get('/team-weekly-report', requireRole('MANAGER', 'HR'), dailyOutputController.getTeamWeeklyReport);

module.exports = router;
