const authService = require('../services/authService');

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function verifyMfa(req, res, next) {
  try {
    const result = await authService.verifyMfa(req.body); // 期待 body 有 tempToken 與 tokenCode
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
module.exports = { login, verifyMfa, getMe };
