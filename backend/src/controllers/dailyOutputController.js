const dailyOutputService = require('../services/dailyOutputService');

async function getTags(req, res, next) {
  try {
    const tags = await dailyOutputService.getTags();
    res.json(tags);
  } catch (err) {
    next(err);
  }
}

async function createLog(req, res, next) {
  try {
    const log = await dailyOutputService.createLog(req.body, req.user.userId);
    res.status(201).json(log);
  } catch (err) {
    next(err);
  }
}

async function listMyLogs(req, res, next) {
  try {
    const logs = await dailyOutputService.listMyLogs(req.user.userId, req.query);
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

async function deleteMyLog(req, res, next) {
  try {
    const result = await dailyOutputService.deleteMyLog(req.params.id, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getMyWeeklyReport(req, res, next) {
  try {
    const report = await dailyOutputService.getMyWeeklyReport(req.user.userId, req.query);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

async function getTeamWeeklyReport(req, res, next) {
  try {
    const report = await dailyOutputService.getTeamWeeklyReport(req.user, req.query);
    res.json(report);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTags,
  createLog,
  listMyLogs,
  deleteMyLog,
  getMyWeeklyReport,
  getTeamWeeklyReport,
};
