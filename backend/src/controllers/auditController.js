const auditService = require('../services/auditService');

async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, action, userId } = req.query;
    const result = await auditService.getAuditLogs({ page, limit, action, userId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLogs };
