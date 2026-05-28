const dashboardService = require('../services/dashboardService');

async function getSummary(req, res, next) {
  try {
    const { quarter } = req.query;
    const result = await dashboardService.getDashboardSummary(req.user.userId, { quarter });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getDrillDown(req, res, next) {
  try {
    const { managerId } = req.params;
    const { quarter } = req.query;
    const result = await dashboardService.getDrillDown(req.user.userId, managerId, { quarter });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, getDrillDown };
