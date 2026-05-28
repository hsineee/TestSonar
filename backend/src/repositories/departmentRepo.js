const prisma = require('./prismaClient');

async function findAll() {
  return prisma.department.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

module.exports = { findAll };
