const { z } = require('zod');
const disputeRepo = require('../repositories/disputeRepo');
const goalRepo = require('../repositories/goalRepo');
const userRepo = require('../repositories/userRepo');
const auditService = require('./auditService');

const fileDisputeSchema = z.object({
  goalId: z.string().min(1),
  reason: z.string().min(1),
});

const resolveDisputeSchema = z.object({
  finalScore: z.number().int().min(0).max(100),
});

async function fileDispute({ goalId, reason }, employeeId) {
  const parsed = fileDisputeSchema.safeParse({ goalId, reason });
  if (!parsed.success) {
    const err = new Error('goalId and reason are required');
    err.status = 400;
    throw err;
  }

  const goal = await goalRepo.findById(goalId);
  if (!goal) {
    const err = new Error('Goal not found');
    err.status = 404;
    throw err;
  }
  if (goal.userId !== employeeId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  if (goal.status !== 'REJECTED') {
    const err = new Error('Only REJECTED goals can be disputed');
    err.status = 400;
    throw err;
  }

  const quarter = goal.kpi.quarter;
  const alreadyFiled = await disputeRepo.hasDisputeInQuarter(employeeId, quarter);
  if (alreadyFiled) {
    const err = new Error('You have already filed a dispute this quarter');
    err.status = 409;
    throw err;
  }

  const dispute = await disputeRepo.create({ goalId, employeeId, reason });
  await goalRepo.updateStatus(goalId, 'DISPUTED');

  await auditService.log({
    action: 'DISPUTE_FILED',
    userId: employeeId,
    targetId: goalId,
    targetType: 'GOAL',
    meta: { disputeId: dispute.id, reason },
  });

  return dispute;
}

async function getPendingDisputes(upperManagerId) {
  return disputeRepo.findPendingForUpperManager(upperManagerId);
}

async function resolveDispute(disputeId, { finalScore }, resolverId) {
  const parsed = resolveDisputeSchema.safeParse({ finalScore });
  if (!parsed.success) {
    const err = new Error('finalScore must be a number between 0 and 100');
    err.status = 400;
    throw err;
  }

  const dispute = await disputeRepo.findById(disputeId);
  if (!dispute) {
    const err = new Error('Dispute not found');
    err.status = 404;
    throw err;
  }
  if (dispute.status !== 'PENDING') {
    const err = new Error('This dispute has already been resolved');
    err.status = 409;
    throw err;
  }

  // 直屬主管不能裁定（bypass 規則）
  const directManagerId = dispute.employee.managerId;
  if (resolverId === directManagerId) {
    const err = new Error('Direct manager cannot resolve their own subordinate\'s dispute');
    err.status = 403;
    throw err;
  }

  // 裁定者必須是該直屬主管的上位主管
  const directManager = await userRepo.findById(directManagerId);
  if (!directManager || directManager.managerId !== resolverId) {
    const err = new Error('Only the upper manager can resolve this dispute');
    err.status = 403;
    throw err;
  }

  await disputeRepo.resolve(disputeId, { finalScore, resolvedById: resolverId });
  await goalRepo.updateStatus(dispute.goalId, 'DISPUTE_RESOLVED');

  await auditService.log({
    action: 'DISPUTE_RESOLVED',
    userId: resolverId,
    targetId: dispute.goalId,
    targetType: 'GOAL',
    meta: { disputeId, finalScore },
  });

  return { ok: true };
}

module.exports = { fileDispute, getPendingDisputes, resolveDispute };
