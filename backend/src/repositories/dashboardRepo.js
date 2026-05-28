const prisma = require('./prismaClient');

/**
 * Recursively collect all user IDs that are below a given manager
 * (includes direct reports and their reports, etc.).
 * Returns an array of user IDs (strings).
 */
async function getAllSubordinateIds(managerId) {
  const ids = [];
  const queue = [managerId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const reports = await prisma.user.findMany({
      where: { managerId: currentId },
      select: { id: true, role: true },
    });
    for (const r of reports) {
      ids.push(r.id);
      queue.push(r.id);
    }
  }

  return ids;
}

/**
 * Returns all goals (non-DRAFT) for a set of user IDs,
 * optionally filtered by KPI quarter.
 */
async function getGoalsForUsers(userIds, quarter) {
  const where = {
    userId: { in: userIds },
    status: { not: 'DRAFT' },
  };

  if (quarter) {
    where.kpi = { quarter };
  }

  return prisma.goal.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true, managerId: true } },
      kpi: { select: { id: true, title: true, quarter: true } },
    },
  });
}

/**
 * Returns all users (direct reports) for a given managerId.
 */
async function getDirectReports(managerId) {
  return prisma.user.findMany({
    where: { managerId },
    select: { id: true, name: true, email: true, role: true },
  });
}

/**
 * Returns all KPIs, optionally filtered by quarter.
 */
async function getKpis(quarter) {
  const where = quarter ? { quarter } : {};
  return prisma.kpi.findMany({
    where,
    select: { id: true, title: true, quarter: true },
    orderBy: { quarter: 'desc' },
  });
}

/**
 * Returns distinct quarters available in the KPI table.
 */
async function getAvailableQuarters() {
  const rows = await prisma.kpi.findMany({
    select: { quarter: true },
    distinct: ['quarter'],
    orderBy: { quarter: 'desc' },
  });
  return rows.map((r) => r.quarter);
}

module.exports = {
  getAllSubordinateIds,
  getGoalsForUsers,
  getDirectReports,
  getKpis,
  getAvailableQuarters,
};
