const prisma = require('./prismaClient');
const { encrypt, decrypt } = require('../utils/cryptoUtils');

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  level: true,
  isActive: true,
  managerId: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
};

function decryptUser(user) {
  if (!user) return user;
  if (user.name) user.name = decrypt(user.name);
  if (user.manager?.name) user.manager.name = decrypt(user.manager.name); // 如果有查詢上層主管，主管的名稱也要解密
  return user;
}

async function findByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, name: true, role: true, managerId: true, isActive: true, mfaEnabled: true, mfaSecret: true },
  });
  return decryptUser(user);
}

async function findById(id) {
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  return decryptUser(user);
}

async function isDirectReport(employeeId, managerId) {
  const user = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { managerId: true },
  });
  return user?.managerId === managerId;
}

async function findReportsByManagerId(managerId) {
  const reports = await prisma.user.findMany({
    where: { managerId },
    select: { id: true, name: true, email: true, role: true },
  });
  return reports.map(decryptUser);
}

// Returns IDs of all users in the management chain below managerId (BFS, avoids N+1)
async function findAllReportsRecursive(managerId) {
  const allIds = [];
  let frontier = [managerId];

  while (frontier.length > 0) {
    const reports = await prisma.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    const ids = reports.map((u) => u.id);
    allIds.push(...ids);
    frontier = ids;
  }

  return allIds;
}

async function listAll({ departmentId, role, isActive } = {}) {
  const where = {};
  if (departmentId !== undefined) where.departmentId = departmentId;
  if (role !== undefined) where.role = role;
  if (isActive !== undefined) where.isActive = isActive;

  const users = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  return users.map(decryptUser);
}

async function listManagersByDepartment(departmentId) {
  const where = { role: 'MANAGER' };
  if (departmentId) where.departmentId = departmentId;
  
  const managers = await prisma.user.findMany({
    where,
    select: { id: true, name: true, departmentId: true },
    orderBy: { name: 'asc' },
  });
  return managers.map(decryptUser);
}

async function createUser(data) {
  if (data.name) data.name = encrypt(data.name);
  const user = await prisma.user.create({ data, select: USER_SELECT });
  return decryptUser(user);
}

async function updateUser(id, data) {
  if (data.name) data.name = encrypt(data.name);
  const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });
  return decryptUser(user);
}

async function setActive(id, isActive) {
  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: USER_SELECT,
  });
  return decryptUser(user);
}

module.exports = {
  findByEmail,
  findById,
  isDirectReport,
  findReportsByManagerId,
  findAllReportsRecursive,
  listAll,
  listManagersByDepartment,
  createUser,
  updateUser,
  setActive,
};
