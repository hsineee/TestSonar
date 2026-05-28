const goalService = require('../services/goalService');

async function deleteDraft(req, res, next) {
  try {
    await goalService.deleteDraft(req.params.id, req.user.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function updateDraft(req, res, next) {
  try {
    const goal = await goalService.updateDraft(req.params.id, req.body, req.user.userId);
    res.json(goal);
  } catch (err) {
    next(err);
  }
}

async function submitGoal(req, res, next) {
  try {
    const goal = await goalService.submitGoal(req.params.id, req.user.userId);
    res.json(goal);
  } catch (err) {
    next(err);
  }
}

async function getGoalLogs(req, res, next) {
  try {
    const logs = await goalService.getGoalProgressLogs(req.params.id, req.user.userId);
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

async function getMyGoals(req, res, next) {
  try {
    const goals = await goalService.getMyGoals(req.user.userId);
    res.json(goals);
  } catch (err) {
    next(err);
  }
}

async function createGoal(req, res, next) {
  try {
    const goal = await goalService.createGoal(req.body, req.user.userId);
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
}

async function updateProgress(req, res, next) {
  try {
    const goal = await goalService.updateProgress(
      req.params.id,
      req.body,
      req.user.userId
    );
    res.json(goal);
  } catch (err) {
    next(err);
  }
}

async function getTeamGoals(req, res, next) {
  try {
    const result = await goalService.getTeamGoals(req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function rejectGoal(req, res, next) {
  try {
    const goal = await goalService.rejectGoal(
      req.params.id,
      req.body,
      req.user.userId
    );
    res.json(goal);
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyGoals, createGoal, submitGoal, updateDraft, deleteDraft, updateProgress, getGoalLogs, getTeamGoals, rejectGoal };
