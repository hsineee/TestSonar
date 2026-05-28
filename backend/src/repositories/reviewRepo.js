const prisma = require('./prismaClient');

class ReviewRepository {
  async getUserById(id) {
    return await prisma.user.findUnique({ where: { id } });
  }

  async getAllTemplates() {
    return await prisma.reviewTemplate.findMany({
      include: { createdBy: { select: { name: true } } }
    });
  }

  async createTemplate(data) {
    return await prisma.reviewTemplate.create({ data });
  }

  async getTemplateById(id) {
    return await prisma.reviewTemplate.findUnique({ where: { id } });
  }

  async getReviewsByUser(userId) {
    return await prisma.performanceReview.findMany({
      where: { userId },
      include: { 
        template: true,
        feedbacks: true
      }
    });
  }

  async getSelfReview(userId) {
    return await prisma.performanceReview.findFirst({
      where: {
        userId: userId,
        reviewerId: userId,
      },
      include: {
        feedbacks: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async createReview(data) {
    return await prisma.performanceReview.create({
      data: {
        userId: data.userId,
        reviewerId: data.reviewerId,
        templateId: data.templateId || null,
        status: data.status,
        finalGrade: data.finalGrade,
        overallComment: data.overallComment,
        feedbacks: {
          create: data.feedbacks
        }
      },
      include: {
        feedbacks: true
      }
    });
  }

  async updateReview(id, data) {
    return await prisma.performanceReview.update({
      where: { id },
      data
    });
  }

  async updateTemplate(id, data) {
    return await prisma.reviewTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(id) {
    return await prisma.reviewTemplate.delete({
      where: { id },
    });
  }

}

module.exports = new ReviewRepository();