const prisma = require('./prismaClient');

class PeriodRepository {
  async findAll() {
    return prisma.performancePeriod.findMany({
      orderBy: { quarter: 'asc' },
    });
  }

  async findUnique(quarter) {
    return prisma.performancePeriod.findUnique({
      where: { quarter },
    });
  }

  async create({ quarter }) {
    return prisma.performancePeriod.create({
      data: { quarter },
    });
  }

  async delete(id) {
    return prisma.performancePeriod.delete({
      where: { id },
    });
  }

  async findById(id) {
    return prisma.performancePeriod.findUnique({
      where: { id },
    });
  }
}

module.exports = new PeriodRepository();
