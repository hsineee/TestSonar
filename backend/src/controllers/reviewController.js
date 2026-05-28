const reviewService = require('../services/reviewService');

class ReviewController {
  async getTemplates(req, res) {
    try {
      const templates = await reviewService.getAllTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createTemplate(req, res) {
    try {
      const template = await reviewService.createTemplate(req.body, req.user.userId);
      res.status(201).json(template);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getReviews(req, res) {
    try {
      const targetUserId = (req.user.role === 'MANAGER' && req.query.userId) 
        ? req.query.userId 
        : req.user.userId;

      const reviews = await reviewService.getReviewsByUser(targetUserId);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createReview(req, res) {
    try {
      const review = await reviewService.createReview(
        req.body, 
        req.user.userId, 
        req.user.role
      );
      res.status(201).json(review);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateReviewStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const review = await reviewService.updateReviewStatus(id, status, req.user.userId);
      res.json(review);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = await reviewService.updateTemplate(id, req.body, req.user.userId);
      res.json(template);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const result = await reviewService.deleteTemplate(id, req.user.userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new ReviewController();