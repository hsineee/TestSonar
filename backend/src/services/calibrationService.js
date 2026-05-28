const calibrationRepo = require('../repositories/calibrationRepo');
const auditService = require('./auditService');
const { z } = require('zod');

const levelStandardSchema = z.object({
  level: z.string().min(1),
  dimensionName: z.string().min(1),
  targetValue: z.number().min(0)
});

class CalibrationService {
  async getLevelStandards() {
    return await calibrationRepo.getAllLevelStandards();
  }

  async createLevelStandard(data, userId) {
    const { level, dimensionName, targetValue } = data;

    const existing = await calibrationRepo.findStandardByLevelAndDimension(level, dimensionName);

    let standard;
    if (existing) {
      standard = await calibrationRepo.updateLevelStandard(existing.id, targetValue, userId);
      await auditService.log({
        action: 'LEVEL_STANDARD_UPDATED',
        userId,
        targetId: standard.id,
        targetType: 'LevelStandard',
        meta: { level, dimensionName, newTarget: targetValue }
      });
    } else {
      standard = await calibrationRepo.createLevelStandard({
        level, dimensionName, targetValue, setById: userId
      });
      await auditService.log({
        action: 'LEVEL_STANDARD_CREATED',
        userId,
        targetId: standard.id,
        targetType: 'LevelStandard',
        meta: { level, dimensionName, targetValue }
      });
    }

    return standard;
  }

  async deleteLevelStandard(standardId, userId) {
    const standard = await calibrationRepo.getStandardById(standardId);
    if (!standard) {
      throw new Error('找不到該職級標準');
    }

    if (standard.setById !== userId) {
      throw new Error('權限不足：您只能收回自己發布的標準規則');
    }

    await calibrationRepo.deleteLevelStandard(standardId);

    await auditService.log({
      action: 'LEVEL_STANDARD_DELETED',
      userId,
      targetId: standardId,
      targetType: 'LevelStandard',
      meta: { level: standard.level, dimensionName: standard.dimensionName }
    });

    return true;
  }

  async getComparisonDashboard(managerId) {
    const subordinates = await calibrationRepo.getSubordinatesWithReviews(managerId);
    const standards = await calibrationRepo.getAllLevelStandards();

    const priorityDict = {};
    
    standards.forEach(std => {
      const key = `${std.level}_${std.dimensionName}`;
      
      if (!priorityDict[key]) {
        priorityDict[key] = std;
      } else {
        const currentWinner = priorityDict[key];
        const isCurrentWinnerManager = currentWinner.setById === managerId;
        const isNewStdManager = std.setById === managerId;

        if (isNewStdManager && !isCurrentWinnerManager) {
          priorityDict[key] = std;
        } 
        else if (!isNewStdManager && !isCurrentWinnerManager) {
          if (new Date(std.updatedAt) > new Date(currentWinner.updatedAt)) {
            priorityDict[key] = std;
          }
        }
      }
    });

    const finalStandardDict = {};
    Object.keys(priorityDict).forEach(key => {
      finalStandardDict[key] = priorityDict[key].targetValue;
    });

    return subordinates.map(user => {
      const latestReview = user.reviewsReceived.length > 0 ? user.reviewsReceived[0] : null;
      let evaluatedMetrics = [];

      if (latestReview && latestReview.feedbacks) {
        evaluatedMetrics = latestReview.feedbacks.map(fb => {
          if (fb.metricType === 'quantitative' && fb.quantScore !== null) {
            const thresholdKey = `${user.level}_${fb.dimensionName}`;
            const targetValue = finalStandardDict[thresholdKey];

            return {
              dimensionName: fb.dimensionName,
              metricType: fb.metricType,
              score: fb.quantScore,
              targetValue: targetValue || null,
              meetsThreshold: targetValue !== undefined && targetValue !== null ? fb.quantScore >= targetValue : null,
              gapAnalysis: fb.gapAnalysis
            };
          }
          
          return {
            dimensionName: fb.dimensionName,
            metricType: fb.metricType,
            impressionScore: fb.impression,
            comment: fb.comment,
            gapAnalysis: fb.gapAnalysis
          };
        });
      }

      return {
        userId: user.id,
        name: user.name,
        level: user.level,
        hasReview: !!latestReview,
        reviewId: latestReview ? latestReview.id : null,
        metrics: evaluatedMetrics
      };
    });
  }
}

module.exports = new CalibrationService();