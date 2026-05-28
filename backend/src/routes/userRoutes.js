const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/userController');

const router = express.Router();

router.get('/managers', authMiddleware, requireRole('HR'), ctrl.listManagers);
router.get('/', authMiddleware, requireRole('HR', 'MANAGER'), ctrl.listUsers);
router.post('/', authMiddleware, requireRole('HR'), ctrl.createUser);
router.get('/:id', authMiddleware, ctrl.getUserById);
router.patch('/:id/deactivate', authMiddleware, requireRole('HR'), ctrl.deactivateUser);
router.patch('/:id/activate', authMiddleware, requireRole('HR'), ctrl.activateUser);
router.patch('/:id', authMiddleware, requireRole('HR'), ctrl.updateUser);

module.exports = router;
