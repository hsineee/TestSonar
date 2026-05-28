const prisma = require('./prismaClient');

class CalibrationRepository {
  async getAllLevelStandards() {
    return await prisma.levelStandard.findMany({
      include: {
        setBy: { select: { name: true } }
      },
      orderBy: [
        { level: 'asc' },
        { dimensionName: 'asc' }
      ]
    });
  }

  async createLevelStandard(data) {
    return await prisma.levelStandard.create({
      data: {
        level: data.level,
        dimensionName: data.dimensionName,
        targetValue: data.targetValue,
        setById: data.setById
      }
    });
  }

  async getSubordinatesWithReviews(managerId) {
    return await prisma.user.findMany({
      where: { 
        managerId: managerId 
      },
      select: {
        id: true,
        name: true,
        level: true,
        
        reviewsReceived: {
          where: {
            reviewerId: managerId,
            status: { in: ['SUBMITTED', 'APPROVED'] }
          },
          include: {
            feedbacks: true 
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
  }

  async findStandardBySetter(setById, level, dimensionName) {
    return await prisma.levelStandard.findFirst({
      where: {
        setById,
        level,
        dimensionName
      }
    });
  }

  async findStandardByLevelAndDimension(level, dimensionName) {
    return await prisma.levelStandard.findFirst({
      where: {
        level,
        dimensionName
      }
    });
  }

  async updateLevelStandard(id, targetValue, setById) {
    const updateData = { targetValue };
    if (setById !== undefined) {
      updateData.setById = setById;
    }
    return await prisma.levelStandard.update({
      where: { id },
      data: updateData
    });
  }

  async getStandardById(id) {
    return await prisma.levelStandard.findUnique({
      where: { id }
    });
  }

  async deleteLevelStandard(id) {
    return await prisma.levelStandard.delete({
      where: { id }
    });
  }
}

module.exports = new CalibrationRepository();