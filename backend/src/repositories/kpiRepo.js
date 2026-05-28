const prisma = require('./prismaClient');

async function findByQuarter(quarter, createdByIds) {
  const where = { quarter };
  if (createdByIds) {
    where.createdById = { in: createdByIds };
  }
  return prisma.kpi.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function findAll(createdByIds) {
  const where = {};
  if (createdByIds) {
    where.createdById = { in: createdByIds };
  }
  return prisma.kpi.findMany({
    where,
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function findById(id) {
  return prisma.kpi.findUnique({ where: { id } });
}

async function create({ title, description, quarter, createdById }) {
  return prisma.kpi.create({
    data: { title, description, quarter, createdById },
  });
}

module.exports = { findByQuarter, findAll, findById, create };
