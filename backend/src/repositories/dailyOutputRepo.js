const prisma = require('./prismaClient');

const TAG_SELECT = {
  id: true,
  code: true,
  name: true,
  unit: true,
  description: true,
  sortOrder: true,
  isActive: true,
};

const LOG_INCLUDE = {
  tag: { select: { id: true, code: true, name: true, unit: true } },
  user: { select: { id: true, name: true, email: true, role: true, managerId: true, departmentId: true } },
};

async function findActiveTags() {
  return prisma.dailyOutputTag.findMany({
    where: { isActive: true },
    select: TAG_SELECT,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

async function findTagById(id) {
  return prisma.dailyOutputTag.findUnique({
    where: { id },
    select: TAG_SELECT,
  });
}

async function createLog(data) {
  return prisma.dailyOutputLog.create({
    data,
    include: LOG_INCLUDE,
  });
}

async function findLogById(id) {
  return prisma.dailyOutputLog.findUnique({
    where: { id },
    include: LOG_INCLUDE,
  });
}

async function deleteLog(id) {
  return prisma.dailyOutputLog.delete({
    where: { id },
  });
}

async function findLogsByUserId(userId, { from, to } = {}) {
  const where = { userId };
  if (from || to) {
    where.logDate = {};
    if (from) where.logDate.gte = from;
    if (to) where.logDate.lte = to;
  }

  return prisma.dailyOutputLog.findMany({
    where,
    include: LOG_INCLUDE,
    orderBy: [{ logDate: 'desc' }, { createdAt: 'desc' }],
  });
}

async function findLogsByUserIds(userIds, { from, to } = {}) {
  if (!userIds || userIds.length === 0) return [];

  const where = { userId: { in: userIds } };
  if (from || to) {
    where.logDate = {};
    if (from) where.logDate.gte = from;
    if (to) where.logDate.lte = to;
  }

  return prisma.dailyOutputLog.findMany({
    where,
    include: LOG_INCLUDE,
    orderBy: [{ userId: 'asc' }, { logDate: 'desc' }, { createdAt: 'desc' }],
  });
}

module.exports = {
  findActiveTags,
  findTagById,
  createLog,
  findLogById,
  deleteLog,
  findLogsByUserId,
  findLogsByUserIds,
};
