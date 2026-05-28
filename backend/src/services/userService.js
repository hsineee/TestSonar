const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepo');
const auditService = require('./auditService');

async function listUsers(requestor, { departmentId, role, isActive } = {}) {
  if (requestor.role === 'HR') {
    return userRepo.listAll({ departmentId, role, isActive });
  }

  if (requestor.role === 'MANAGER') {
    const [reportIds, self] = await Promise.all([
      userRepo.findAllReportsRecursive(requestor.userId),
      userRepo.findById(requestor.userId),
    ]);
    if (reportIds.length === 0) return [];

    const users = await userRepo.listAll({ role, isActive });
    return users.filter(
      (u) => reportIds.includes(u.id) && u.departmentId === self?.departmentId
    );
  }

  const err = new Error('Forbidden');
  err.status = 403;
  throw err;
}

async function getUserById(requestor, targetId) {
  const target = await userRepo.findById(targetId);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  if (requestor.role === 'HR') return target;
  if (requestor.userId === targetId) return target;

  if (requestor.role === 'MANAGER') {
    const reportIds = await userRepo.findAllReportsRecursive(requestor.userId);
    if (reportIds.includes(targetId)) return target;
  }

  const err = new Error('Forbidden');
  err.status = 403;
  throw err;
}

async function createUser(actorId, { name, email, password, role, level, managerId, departmentId }) {
  if (!name || !email || !password || !role) {
    const err = new Error('name, email, password, role are required');
    err.status = 400;
    throw err;
  }

  const existing = await userRepo.findByEmail(email);
  if (existing) {
    const err = new Error('Email already exists');
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepo.createUser({
    name,
    email,
    passwordHash,
    role,
    level: level || null,
    managerId: managerId || null,
    departmentId: departmentId || null,
  });

  await auditService.log({
    action: 'USER_CREATED',
    userId: actorId,
    targetId: user.id,
    targetType: 'User',
    meta: { name, email, role },
  });

  return user;
}

async function updateUser(actorId, targetId, { name, role, level, managerId, departmentId }) {
  const target = await userRepo.findById(targetId);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (role !== undefined) data.role = role;
  if (level !== undefined) data.level = level;
  if (managerId !== undefined) data.managerId = managerId || null;
  if (departmentId !== undefined) data.departmentId = departmentId || null;

  const updated = await userRepo.updateUser(targetId, data);

  await auditService.log({
    action: 'USER_UPDATED',
    userId: actorId,
    targetId,
    targetType: 'User',
    meta: data,
  });

  return updated;
}

async function deactivateUser(actorId, targetId) {
  const target = await userRepo.findById(targetId);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (actorId === targetId) {
    const err = new Error('Cannot deactivate your own account');
    err.status = 400;
    throw err;
  }

  const updated = await userRepo.setActive(targetId, false);

  await auditService.log({
    action: 'USER_DEACTIVATED',
    userId: actorId,
    targetId,
    targetType: 'User',
    meta: { name: target.name },
  });

  return updated;
}

async function activateUser(actorId, targetId) {
  const target = await userRepo.findById(targetId);
  if (!target) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const updated = await userRepo.setActive(targetId, true);

  await auditService.log({
    action: 'USER_ACTIVATED',
    userId: actorId,
    targetId,
    targetType: 'User',
    meta: { name: target.name },
  });

  return updated;
}

async function listManagers(departmentId) {
  return userRepo.listManagersByDepartment(departmentId);
}

module.exports = { listUsers, getUserById, createUser, updateUser, deactivateUser, activateUser, listManagers };
