const auditRepo = require('../repositories/auditRepo');

async function log({ action, userId, targetId, targetType, meta }) {
  return auditRepo.log({ action, userId, targetId, targetType, meta });
}

async function getAuditLogs({ page, limit, action, userId } = {}) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (action) {
    where.action = action;
  }
  if (userId) {
    where.userId = userId;
  }

  const { logs, total } = await auditRepo.findAndCount({ where, skip, take: limitNum });

  return {
    logs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

module.exports = { log, getAuditLogs };
