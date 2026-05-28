const express = require('express');
const periodController = require('../controllers/periodController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', periodController.getPeriods);
router.post('/', requireRole('HR'), periodController.createPeriod);
router.delete('/:id', requireRole('HR'), periodController.deletePeriod);

module.exports = router;
