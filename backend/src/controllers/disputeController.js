const disputeService = require('../services/disputeService');

async function fileDispute(req, res, next) {
  try {
    const dispute = await disputeService.fileDispute(req.body, req.user.userId);
    res.status(201).json(dispute);
  } catch (err) {
    next(err);
  }
}

async function getPendingDisputes(req, res, next) {
  try {
    const disputes = await disputeService.getPendingDisputes(req.user.userId);
    res.json(disputes);
  } catch (err) {
    next(err);
  }
}

async function resolveDispute(req, res, next) {
  try {
    const result = await disputeService.resolveDispute(req.params.id, req.body, req.user.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { fileDispute, getPendingDisputes, resolveDispute };
