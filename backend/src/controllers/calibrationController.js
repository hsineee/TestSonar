const calibrationService = require('../services/calibrationService');

class CalibrationController {
  async getStandards(req, res) {
    try {
      const standards = await calibrationService.getLevelStandards();
      res.json(standards);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createStandard(req, res) {
    try {
      const standard = await calibrationService.createLevelStandard(req.body, req.user.userId);
      res.status(201).json(standard);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getDashboard(req, res) {
    try {
      const dashboardData = await calibrationService.getComparisonDashboard(req.user.userId);
      res.json(dashboardData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async deleteStandard(req, res) {
    try {
      const { id } = req.params;
      await calibrationService.deleteLevelStandard(id, req.user.userId);
      res.json({ message: '該職級基準規則已成功收回' });
    } catch (error) {
      if (error.message.includes('權限不足') || error.message.includes('找不到')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new CalibrationController();