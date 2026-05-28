const prisma = require('./prismaClient');

async function create({ goalId, employeeId, reason }) {
  return prisma.dispute.create({
    data: { goalId, employeeId, reason },
    include: {
      goal: { select: { id: true, title: true } },
      employee: { select: { id: true, name: true, email: true } },
    },
  });
}

async function findPendingForUpperManager(upperManagerId) {
  // 找出直屬下屬中角色為 MANAGER 的人所管轄員工的 PENDING 異議
  return prisma.dispute.findMany({
    where: {
      status: 'PENDING',
      employee: {
        manager: {
          managerId: upperManagerId,
        },
      },
    },
    include: {
      goal: {
        select: {
          id: true,
          title: true,
          specific: true,
          measurable: true,
          achievable: true,
          relevant: true,
          dueDate: true,
          progress: true,
          rejectReason: true,
          kpi: { select: { id: true, title: true, quarter: true } },
        },
      },
      employee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function findByEmployeeId(employeeId) {
  return prisma.dispute.findMany({
    where: { employeeId },
    include: {
      goal: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function findById(id) {
  return prisma.dispute.findUnique({
    where: { id },
    include: {
      goal: {
        include: {
          user: { select: { id: true, managerId: true } },
          kpi: { select: { quarter: true } },
        },
      },
      employee: { select: { id: true, name: true, managerId: true } },
    },
  });
}

async function hasDisputeInQuarter(employeeId, quarter) {
  const count = await prisma.dispute.count({
    where: {
      employeeId,
      goal: { kpi: { quarter } },
    },
  });
  return count > 0;
}

async function resolve(id, { finalScore, resolvedById }) {
  return prisma.dispute.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      finalScore,
      resolvedById,
      resolvedAt: new Date(),
    },
  });
}

module.exports = { create, findPendingForUpperManager, findByEmployeeId, findById, hasDisputeInQuarter, resolve };
