const periodService = require('../services/periodService');

class PeriodController {
  async getPeriods(req, res, next) {
    try {
      const periods = await periodService.getAllPeriods();
      res.json(periods);
    } catch (err) {
      next(err);
    }
  }

  async createPeriod(req, res, next) {
    try {
      const period = await periodService.createPeriod(req.body, req.user.userId);
      res.status(201).json(period);
    } catch (err) {
      next(err);
    }
  }

  async deletePeriod(req, res, next) {
    try {
      const { id } = req.params;
      const result = await periodService.deletePeriod(id, req.user.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PeriodController();
