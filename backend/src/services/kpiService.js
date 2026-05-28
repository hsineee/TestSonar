const { z } = require('zod');
const kpiRepo = require('../repositories/kpiRepo');
const userRepo = require('../repositories/userRepo');
const periodRepo = require('../repositories/periodRepo');
const auditService = require('./auditService');

const quarterRegex = /^\d{4}Q[1-4]$/;

const createKpiSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  quarter: z.string().regex(quarterRegex, 'Quarter must be in format 2026Q1'),
});

async function getKpis(quarter, userId) {
  if (!userId) {
    if (quarter) {
      return kpiRepo.findByQuarter(quarter);
    }
    return kpiRepo.findAll();
  }

  const user = await userRepo.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  let createdByIds = [];
  if (user.role === 'EMPLOYEE') {
    if (user.managerId) {
      createdByIds = [user.managerId];
    }
  } else if (user.role === 'MANAGER') {
    if (user.managerId === null) {
      createdByIds = [user.id];
    } else {
      createdByIds = [user.managerId, user.id];
    }
  } else {
    // HR or others: return empty list
    createdByIds = [];
  }

  if (createdByIds.length === 0) {
    return [];
  }

  if (quarter) {
    return kpiRepo.findByQuarter(quarter, createdByIds);
  }
  return kpiRepo.findAll(createdByIds);
}

async function createKpi({ title, description, quarter, createdById }) {
  const parsed = createKpiSchema.safeParse({ title, description, quarter });
  if (!parsed.success) {
    const err = new Error(parsed.error.errors[0].message);
    err.status = 400;
    throw err;
  }

  const period = await periodRepo.findUnique(quarter);
  if (!period) {
    const err = new Error('Performance period not found');
    err.status = 400;
    throw err;
  }

  const kpi = await kpiRepo.create({ title, description, quarter, createdById });
  
  await auditService.log({
    action: 'KPI_CREATED',
    userId: createdById,
    targetId: kpi.id,
    targetType: 'KPI',
    meta: { title, quarter },
  });

  return kpi;
}

module.exports = { getKpis, createKpi };
