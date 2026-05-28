const prisma = require('./prismaClient');

async function log({ action, userId, targetId, targetType, meta }) {
  return prisma.auditLog.create({
    data: { action, userId, targetId, targetType, meta },
  });
}

async function findByTargetId(targetId) {
  return prisma.auditLog.findMany({
    where: { targetId },
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function findAndCount({ where, skip, take }) {
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { logs, total };
}

module.exports = { log, findByTargetId, findAndCount };
