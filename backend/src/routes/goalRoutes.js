const express = require('express');
const {
  getMyGoals,
  createGoal,
  submitGoal,
  updateDraft,
  deleteDraft,
  updateProgress,
  getGoalLogs,
  getTeamGoals,
  rejectGoal,
} = require('../controllers/goalController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

// NOTE: /team must be registered before /:id to avoid route conflict
router.get('/team', authMiddleware, requireRole('MANAGER', 'HR'), getTeamGoals);
router.get('/', authMiddleware, getMyGoals);
router.post('/', authMiddleware, requireRole('EMPLOYEE'), createGoal);
router.patch('/:id/progress', authMiddleware, requireRole('EMPLOYEE'), updateProgress);
router.get('/:id/logs', authMiddleware, requireRole('EMPLOYEE'), getGoalLogs);
router.patch('/:id/submit', authMiddleware, requireRole('EMPLOYEE'), submitGoal);
router.put('/:id/draft', authMiddleware, requireRole('EMPLOYEE'), updateDraft);
router.delete('/:id/draft', authMiddleware, requireRole('EMPLOYEE'), deleteDraft);
router.patch('/:id/reject', authMiddleware, requireRole('MANAGER'), rejectGoal);

module.exports = router;
