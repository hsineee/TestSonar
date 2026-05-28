const { z } = require('zod');
const goalRepo = require('../repositories/goalRepo');
const kpiRepo = require('../repositories/kpiRepo');
const userRepo = require('../repositories/userRepo');
const auditService = require('./auditService');
const auditRepo = require('../repositories/auditRepo');

const createGoalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  specific: z.string().min(1, 'Specific is required'),
  measurable: z.string().min(1, 'Measurable is required'),
  achievable: z.string().min(1, 'Achievable is required'),
  relevant: z.string().min(1, 'Relevant is required'),
  dueDate: z.string().datetime({ message: 'dueDate must be ISO datetime' }),
  kpiId: z.string().min(1, 'kpiId is required'),
});

const updateProgressSchema = z.object({
  progress: z
    .number()
    .int()
    .min(0, 'Progress must be >= 0')
    .max(100, 'Progress must be <= 100'),
});

const rejectGoalSchema = z.object({
  reason: z.string().min(1, 'Reject reason is required'),
});

async function getMyGoals(userId) {
  return goalRepo.findByUserId(userId);
}

async function createGoal(data, userId) {
  const parsed = createGoalSchema.safeParse(data);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors[0].message);
    err.status = 400;
    throw err;
  }

  const kpi = await kpiRepo.findById(parsed.data.kpiId);
  if (!kpi) {
    const err = new Error('KPI not found');
    err.status = 404;
    throw err;
  }

  const status = data.isDraft ? 'DRAFT' : 'ACTIVE';

  const goal = await goalRepo.create({
    title: parsed.data.title,
    specific: parsed.data.specific,
    measurable: parsed.data.measurable,
    achievable: parsed.data.achievable,
    relevant: parsed.data.relevant,
    dueDate: new Date(parsed.data.dueDate),
    kpiId: parsed.data.kpiId,
    userId,
    status,
  });

  await auditService.log({
    action: 'GOAL_CREATED',
    userId,
    targetId: goal.id,
    targetType: 'GOAL',
    meta: { title: goal.title, kpiId: goal.kpiId, isDraft: status === 'DRAFT' },
  });

  return goal;
}

async function submitGoal(goalId, requestingUserId) {
  const goal = await goalRepo.findById(goalId);
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }

  if (goal.userId !== requestingUserId) {
    const err = new Error('You can only submit your own goals');
    err.status = 403;
    throw err;
  }

  if (goal.status !== 'DRAFT') {
    const err = new Error('Only draft goals can be submitted');
    err.status = 400;
    throw err;
  }

  const updated = await goalRepo.updateStatus(goalId, 'ACTIVE');

  await auditService.log({
    action: 'GOAL_SUBMITTED',
    userId: requestingUserId,
    targetId: goalId,
    targetType: 'GOAL',
    meta: { title: goal.title },
  });

  return updated;
}

async function updateProgress(goalId, { progress, note }, requestingUserId) {
  const parsed = updateProgressSchema.safeParse({ progress });
  if (!parsed.success) {
    const err = new Error(parsed.error.errors[0].message);
    err.status = 400;
    throw err;
  }

  const goal = await goalRepo.findById(goalId);
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }

  if (goal.userId !== requestingUserId) {
    const err = new Error('You can only update your own goals');
    err.status = 403;
    throw err;
  }

  if (goal.status === 'REJECTED') {
    const err = new Error('Cannot update progress on a rejected goal');
    err.status = 400;
    throw err;
  }

  if (goal.status === 'DISPUTED' || goal.status === 'DISPUTE_RESOLVED') {
    const err = new Error('Cannot update progress while goal is in dispute or resolved');
    err.status = 400;
    throw err;
  }

  const oldProgress = goal.progress;
  const updated = await goalRepo.updateProgress(goalId, parsed.data.progress);

  await auditService.log({
    action: 'GOAL_PROGRESS_UPDATED',
    userId: requestingUserId,
    targetId: goalId,
    targetType: 'GOAL',
    meta: { from: oldProgress, to: parsed.data.progress, status: updated.status, note: note || null },
  });

  return updated;
}

async function getTeamGoals(managerId) {
  const allGoals = await goalRepo.findByManagerId(managerId);
  const goals = allGoals.filter((g) => g.status !== 'DRAFT');
  const reports = await userRepo.findReportsByManagerId(managerId);

  const totalReports = reports.length;
  const alignedCount = reports.filter((r) =>
    goals.some((g) => g.userId === r.id && g.status !== 'REJECTED')
  ).length;

  return {
    goals,
    alignment: {
      total: totalReports,
      aligned: alignedCount,
      percentage: totalReports > 0 ? Math.round((alignedCount / totalReports) * 100) : 0,
    },
  };
}

async function rejectGoal(goalId, { reason }, managerId) {
  const parsed = rejectGoalSchema.safeParse({ reason });
  if (!parsed.success) {
    const err = new Error(parsed.error.errors[0].message);
    err.status = 400;
    throw err;
  }

  const goal = await goalRepo.findById(goalId);
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }

  const isDirect = await userRepo.isDirectReport(goal.userId, managerId);
  if (!isDirect) {
    const err = new Error('You can only reject goals of your direct reports');
    err.status = 403;
    throw err;
  }

  if (goal.status === 'REJECTED') {
    const err = new Error('Goal is already rejected');
    err.status = 400;
    throw err;
  }

  if (goal.status === 'DISPUTED' || goal.status === 'DISPUTE_RESOLVED') {
    const err = new Error('Cannot reject a goal that is in dispute or resolved');
    err.status = 400;
    throw err;
  }

  const updated = await goalRepo.reject(goalId, parsed.data.reason);

  await auditService.log({
    action: 'GOAL_REJECTED',
    userId: managerId,
    targetId: goalId,
    targetType: 'GOAL',
    meta: { reason: parsed.data.reason, employeeId: goal.userId },
  });

  return updated;
}

async function deleteDraft(goalId, requestingUserId) {
  const goal = await goalRepo.findById(goalId);
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }
  if (goal.userId !== requestingUserId) {
    const err = new Error('You can only delete your own goals');
    err.status = 403;
    throw err;
  }
  if (goal.status !== 'DRAFT') {
    const err = new Error('Only draft goals can be deleted');
    err.status = 400;
    throw err;
  }
  await goalRepo.deleteById(goalId);

  await auditService.log({
    action: 'GOAL_DRAFT_DELETED',
    userId: requestingUserId,
    targetId: goalId,
    targetType: 'GOAL',
    meta: { title: goal.title },
  });
}

async function updateDraft(goalId, data, requestingUserId) {
  const parsed = createGoalSchema.safeParse(data);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors[0].message);
    err.status = 400;
    throw err;
  }

  const goal = await goalRepo.findById(goalId);
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }
  if (goal.userId !== requestingUserId) {
    const err = new Error('You can only edit your own goals');
    err.status = 403;
    throw err;
  }
  if (goal.status !== 'DRAFT') {
    const err = new Error('Only draft goals can be edited');
    err.status = 400;
    throw err;
  }

  const kpi = await kpiRepo.findById(parsed.data.kpiId);
  if (!kpi) {
    const err = new Error('KPI not found');
    err.status = 404;
    throw err;
  }

  const updated = await goalRepo.updateDraft(goalId, {
    title: parsed.data.title,
    specific: parsed.data.specific,
    measurable: parsed.data.measurable,
    achievable: parsed.data.achievable,
    relevant: parsed.data.relevant,
    dueDate: new Date(parsed.data.dueDate),
    kpiId: parsed.data.kpiId,
  });

  await auditService.log({
    action: 'GOAL_DRAFT_UPDATED',
    userId: requestingUserId,
    targetId: goalId,
    targetType: 'GOAL',
    meta: { title: updated.title },
  });

  return updated;
}

async function getGoalProgressLogs(goalId, requestingUserId) {
  const goal = await goalRepo.findById(goalId);
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }
  if (goal.userId !== requestingUserId) {
    const err = new Error('You can only view logs of your own goals');
    err.status = 403;
    throw err;
  }
  const logs = await auditRepo.findByTargetId(goalId);
  return logs.filter((l) => l.action === 'GOAL_PROGRESS_UPDATED');
}

module.exports = { getMyGoals, createGoal, submitGoal, updateProgress, updateDraft, deleteDraft, getGoalProgressLogs, getTeamGoals, rejectGoal };
