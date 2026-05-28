const { z } = require('zod');
const periodRepo = require('../repositories/periodRepo');
const auditService = require('./auditService');

const quarterRegex = /^\d{4}Q[1-4]$/;

const periodSchema = z.object({
  quarter: z.string().regex(quarterRegex, 'Quarter must be in format 2026Q1'),
});

class PeriodService {
  async getAllPeriods() {
    return periodRepo.findAll();
  }

  async createPeriod({ quarter }, operatorId) {
    const parsed = periodSchema.safeParse({ quarter });
    if (!parsed.success) {
      const err = new Error(parsed.error.errors[0].message);
      err.status = 400;
      throw err;
    }

    const existing = await periodRepo.findUnique(quarter);
    if (existing) {
      const err = new Error('Performance period already exists');
      err.status = 400;
      throw err;
    }

    const period = await periodRepo.create({ quarter });

    await auditService.log({
      action: 'PERIOD_CREATED',
      userId: operatorId,
      targetId: period.id,
      targetType: 'PerformancePeriod',
      meta: { quarter },
    });

    return period;
  }

  async deletePeriod(id, operatorId) {
    const period = await periodRepo.findById(id);
    if (!period) {
      const err = new Error('Performance period not found');
      err.status = 404;
      throw err;
    }

    await periodRepo.delete(id);

    await auditService.log({
      action: 'PERIOD_DELETED',
      userId: operatorId,
      targetId: id,
      targetType: 'PerformancePeriod',
      meta: { quarter: period.quarter },
    });

    return { success: true };
  }
}

module.exports = new PeriodService();
