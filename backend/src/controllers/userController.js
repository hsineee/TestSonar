const userService = require('../services/userService');
const departmentRepo = require('../repositories/departmentRepo');

async function listUsers(req, res, next) {
  try {
    const { departmentId, role, isActive } = req.query;
    const filter = {
      departmentId: departmentId || undefined,
      role: role || undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    };
    const users = await userService.listUsers(req.user, filter);
    res.json(users);
  } catch (err) {
    next(err);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await userService.getUserById(req.user, req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await userService.createUser(req.user.userId, req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await userService.updateUser(req.user.userId, req.params.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function deactivateUser(req, res, next) {
  try {
    const user = await userService.deactivateUser(req.user.userId, req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function activateUser(req, res, next) {
  try {
    const user = await userService.activateUser(req.user.userId, req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function listManagers(req, res, next) {
  try {
    const { departmentId } = req.query;
    const managers = await userService.listManagers(departmentId);
    res.json(managers);
  } catch (err) {
    next(err);
  }
}

async function listDepartments(req, res, next) {
  try {
    const departments = await departmentRepo.findAll();
    res.json(departments);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  listManagers,
  listDepartments,
};
