const reviewRepo = require('../repositories/reviewRepo');
const auditService = require('./auditService');
const { z } = require('zod');
const { encrypt } = require('../utils/cryptoUtils');

const templateSchema = z.object({
  name: z.string().min(1),
  dimensions: z.array(z.object({
    name: z.string(),
    type: z.enum(['quantitative', 'qualitative'])
  }))
});

const reviewSchema = z.object({
  userId: z.string(),
  templateId: z.string().optional(),
  finalGrade: z.string().optional(),
  overallComment: z.string().optional(),
  feedbacks: z.array(z.object({
    goalId: z.string(),
    dimensionName: z.string(),
    metricType: z.enum(['quantitative', 'qualitative']),
    quantScore: z.number().optional(),
    impression: z.number().min(1).max(5).optional(),
    comment: z.string().optional()
  }))
});

class ReviewService {
  async getAllTemplates() {
    return await reviewRepo.getAllTemplates();
  }

  async createTemplate(data, createdById) {
    const validated = templateSchema.parse(data);
    const template = await reviewRepo.createTemplate({
      ...validated,
      createdById
    });

    await auditService.log({
      action: 'TEMPLATE_CREATED',
      userId: createdById,
      targetId: template.id,
      targetType: 'ReviewTemplate'
    });

    return template;
  }

  async getReviewsByUser(userId) {
    return await reviewRepo.getReviewsByUser(userId);
  }

  async createReview(data, operatorId, operatorRole) {
    const validated = reviewSchema.parse(data);
    const { userId, templateId, finalGrade, overallComment, feedbacks } = validated;

    let reviewData = {
      userId,
      templateId,
      reviewerId: operatorId,
      finalGrade,
      overallComment,
      status: 'SUBMITTED',
      feedbacks: []
    };

    if (operatorRole === 'EMPLOYEE') {
      if (userId !== operatorId) {
        throw new Error('Unauthorized: Employees can only submit self-reviews.');
      }
      reviewData.feedbacks = feedbacks;

    } else if (operatorRole === 'MANAGER') {
      const user = await reviewRepo.getUserById(userId);
      if (!user) throw new Error('User not found');
      if (user.managerId !== operatorId) {
        throw new Error('Unauthorized: Can only review subordinates');
      }
      const selfReview = await reviewRepo.getSelfReview(userId);
      
      reviewData.feedbacks = feedbacks.map(managerFb => {
        let gapAnalysis = null;

        if (selfReview && selfReview.feedbacks) {
          const selfFb = selfReview.feedbacks.find(
            fb => fb.goalId === managerFb.goalId && fb.dimensionName === managerFb.dimensionName
          );
          
          if (selfFb) {
            if (managerFb.metricType === 'qualitative' && managerFb.impression && selfFb.impression) {
              const diff = selfFb.impression - managerFb.impression;
              if (Math.abs(diff) >= 2) {
                gapAnalysis = `【認知落差】員工自評 ${selfFb.impression} 分，主管給予 ${managerFb.impression} 分。`;
              }
            }
            else if (managerFb.metricType === 'quantitative' && managerFb.quantScore !== selfFb.quantScore) {
                gapAnalysis = `【數據不一致】員工填報數值為 ${selfFb.quantScore}，主管核定為 ${managerFb.quantScore}。`;
            }
          }
        }

        return {
          ...managerFb,
          gapAnalysis
        };
      });
    }
    if (reviewData.overallComment) {
      reviewData.overallComment = encrypt(reviewData.overallComment);
    }
    reviewData.feedbacks = reviewData.feedbacks.map(fb => ({
      ...fb,
      comment: fb.comment ? encrypt(fb.comment) : undefined,
      gapAnalysis: fb.gapAnalysis ? encrypt(fb.gapAnalysis) : undefined
    }));

    const review = await reviewRepo.createReview(reviewData);

    await auditService.log({
      action: operatorRole === 'EMPLOYEE' ? 'SELF_REVIEW_CREATED' : 'MANAGER_REVIEW_CREATED',
      userId: operatorId,
      targetId: review.id,
      targetType: 'PerformanceReview'
    });

    return review;
  }

  async updateReviewStatus(id, status, managerId) {
    const review = await reviewRepo.updateReview(id, { status });

    await auditService.log({
      action: `REVIEW_${status.toUpperCase()}`,
      userId: managerId,
      targetId: id,
      targetType: 'PerformanceReview'
    });

    return review;
  }

  async updateTemplate(id, data, operatorId) {
    const validated = templateSchema.parse(data);
    const template = await reviewRepo.updateTemplate(id, validated);

    await auditService.log({
      action: 'TEMPLATE_UPDATED',
      userId: operatorId,
      targetId: id,
      targetType: 'ReviewTemplate'
    });

    return template;
  }

  async deleteTemplate(id, operatorId) {
    await reviewRepo.deleteTemplate(id);

    await auditService.log({
      action: 'TEMPLATE_DELETED',
      userId: operatorId,
      targetId: id,
      targetType: 'ReviewTemplate'
    });

    return { success: true };
  }
}

module.exports = new ReviewService();