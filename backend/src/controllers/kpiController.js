const kpiService = require('../services/kpiService');

async function getKpis(req, res, next) {
  try {
    const { quarter } = req.query;
    const kpis = await kpiService.getKpis(quarter, req.user.userId);
    res.json(kpis);
  } catch (err) {
    next(err);
  }
}

async function createKpi(req, res, next) {
  try {
    const kpi = await kpiService.createKpi({
      ...req.body,
      createdById: req.user.userId,
    });
    res.status(201).json(kpi);
  } catch (err) {
    next(err);
  }
}

module.exports = { getKpis, createKpi };
