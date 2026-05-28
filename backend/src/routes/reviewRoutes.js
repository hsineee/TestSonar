const express = require('express');
const reviewController = require('../controllers/reviewController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/templates', reviewController.getTemplates);
router.post('/templates', requireRole('HR'), reviewController.createTemplate);
router.put('/templates/:id', requireRole('HR'), reviewController.updateTemplate);
router.delete('/templates/:id', requireRole('HR'), reviewController.deleteTemplate);

router.get('/', reviewController.getReviews);

router.post('/', requireRole(['EMPLOYEE', 'MANAGER']), reviewController.createReview);

router.patch('/:id/status', requireRole('MANAGER'), reviewController.updateReviewStatus);

module.exports = router;