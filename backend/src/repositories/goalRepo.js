const prisma = require('./prismaClient');

async function findByUserId(userId) {
  return prisma.goal.findMany({
    where: { userId },
    include: { kpi: { select: { id: true, title: true, quarter: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function findById(id) {
  return prisma.goal.findUnique({
    where: { id },
    include: {
      kpi: { select: { id: true, title: true, quarter: true } },
      user: { select: { id: true, name: true, email: true, managerId: true } },
    },
  });
}

async function findByManagerId(managerId) {
  return prisma.goal.findMany({
    where: { user: { managerId } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      kpi: { select: { id: true, title: true, quarter: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function create(data) {
  return prisma.goal.create({
    data,
    include: { kpi: { select: { id: true, title: true, quarter: true } } },
  });
}

async function updateProgress(id, progress) {
  const status = progress >= 100 ? 'COMPLETED' : 'ACTIVE';
  return prisma.goal.update({
    where: { id },
    data: { progress, status },
  });
}

async function reject(id, rejectReason) {
  return prisma.goal.update({
    where: { id },
    data: { status: 'REJECTED', rejectReason },
  });
}

async function updateStatus(id, status) {
  return prisma.goal.update({
    where: { id },
    data: { status },
    include: { kpi: { select: { id: true, title: true, quarter: true } } },
  });
}

async function deleteById(id) {
  return prisma.goal.delete({ where: { id } });
}

async function updateDraft(id, data) {
  return prisma.goal.update({
    where: { id },
    data,
    include: { kpi: { select: { id: true, title: true, quarter: true } } },
  });
}

module.exports = { findByUserId, findById, findByManagerId, create, updateProgress, reject, updateStatus, deleteById, updateDraft };
