const reviewService = require('../../services/reviewService');
const reviewRepo = require('../../repositories/reviewRepo');
const auditService = require('../../services/auditService');

jest.mock('../../repositories/reviewRepo');
jest.mock('../../services/auditService');

jest.mock('../../utils/cryptoUtils', () => ({
  encrypt: jest.fn((text) => text),
  decrypt: jest.fn((text) => text),
}));

describe('Review Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview (OKR 目標導向版)', () => {
    const mockData = {
      userId: 'emp-123',
      finalGrade: 'A',
      overallComment: '本季表現優異',
      feedbacks: [
        {
          goalId: 'goal-999',
          dimensionName: '目標達成率',
          metricType: 'quantitative',
          quantScore: 60,
        },
        {
          goalId: 'goal-999',
          dimensionName: '困難解決與創新能力',
          metricType: 'qualitative',
          impression: 2,
        }
      ]
    };

    it('應該能成功建立主管他評，並自動執行跨 Goal 的落差分析', async () => {
      reviewRepo.getUserById.mockResolvedValue({ id: 'emp-123', managerId: 'mgr-456' });

      reviewRepo.getSelfReview.mockResolvedValue({
        feedbacks: [
          { goalId: 'goal-999', dimensionName: '目標達成率', quantScore: 85, metricType: 'quantitative' },
          { goalId: 'goal-999', dimensionName: '困難解決與創新能力', impression: 5, metricType: 'qualitative' }
        ]
      });

      reviewRepo.createReview.mockResolvedValue({ id: 'review-new' });

      await reviewService.createReview(mockData, 'mgr-456', 'MANAGER');

      expect(reviewRepo.getSelfReview).toHaveBeenCalledWith('emp-123');

      const createCallArgs = reviewRepo.createReview.mock.calls[0][0];
      
      const quantFeedback = createCallArgs.feedbacks.find(f => f.dimensionName === '目標達成率');
      expect(quantFeedback.goalId).toBe('goal-999');
      expect(quantFeedback.gapAnalysis).toContain('【數據不一致】');

      const qualFeedback = createCallArgs.feedbacks.find(f => f.dimensionName === '困難解決與創新能力');
      expect(qualFeedback.gapAnalysis).toContain('【認知落差】');

      expect(createCallArgs.finalGrade).toBe('A');
      expect(createCallArgs.overallComment).toBe('本季表現優異');
    });

    it('如果是員工自評，不應該執行落差分析', async () => {
      reviewRepo.createReview.mockResolvedValue({ id: 'self-review-111' });

      await reviewService.createReview(mockData, 'emp-123', 'EMPLOYEE');

      expect(reviewRepo.getSelfReview).not.toHaveBeenCalled();

      const createCallArgs = reviewRepo.createReview.mock.calls[0][0];
      expect(createCallArgs.feedbacks[0].gapAnalysis).toBeUndefined();
    });

    it('如果員工試圖幫別人寫自評，應該拋出錯誤', async () => {
      await expect(
        reviewService.createReview(mockData, 'emp-999', 'EMPLOYEE')
      ).rejects.toThrow('Unauthorized: Employees can only submit self-reviews.');
    });
  });

  describe('updateReviewStatus', () => {
    it('應該能成功更新考評狀態，並留下 Audit Log', async () => {
      reviewRepo.updateReview.mockResolvedValue({ id: 'review-123', status: 'COMPLETED' });

      await reviewService.updateReviewStatus('review-123', 'COMPLETED', 'mgr-456');

      expect(reviewRepo.updateReview).toHaveBeenCalledWith('review-123', { status: 'COMPLETED' });
    });
  });

  describe('Review Templates CRUD', () => {
    const templateData = {
      name: 'Quarterly Dev Template',
      dimensions: [
        { name: 'Coding speed', type: 'quantitative' },
        { name: 'Teamwork', type: 'qualitative' }
      ]
    };

    it('should get all templates', async () => {
      reviewRepo.getAllTemplates.mockResolvedValue([{ id: 'temp-123', ...templateData }]);
      const res = await reviewService.getAllTemplates();
      expect(reviewRepo.getAllTemplates).toHaveBeenCalled();
      expect(res).toEqual([{ id: 'temp-123', ...templateData }]);
    });

    it('should create template successfully and log audit', async () => {
      reviewRepo.createTemplate.mockResolvedValue({ id: 'temp-123', ...templateData });
      const res = await reviewService.createTemplate(templateData, 'hr-001');
      expect(reviewRepo.createTemplate).toHaveBeenCalledWith({
        ...templateData,
        createdById: 'hr-001'
      });
      expect(auditService.log).toHaveBeenCalledWith({
        action: 'TEMPLATE_CREATED',
        userId: 'hr-001',
        targetId: 'temp-123',
        targetType: 'ReviewTemplate'
      });
      expect(res).toEqual({ id: 'temp-123', ...templateData });
    });

    it('should fail template validation on invalid dimension types', async () => {
      const invalidData = {
        name: 'Quarterly Dev Template',
        dimensions: [
          { name: 'Coding speed', type: 'invalid_type' }
        ]
      };
      await expect(reviewService.createTemplate(invalidData, 'hr-001')).rejects.toThrow();
    });

    it('should update template successfully and log audit', async () => {
      reviewRepo.updateTemplate.mockResolvedValue({ id: 'temp-123', ...templateData, name: 'Updated Name' });
      const res = await reviewService.updateTemplate('temp-123', { ...templateData, name: 'Updated Name' }, 'hr-001');
      expect(reviewRepo.updateTemplate).toHaveBeenCalledWith('temp-123', { ...templateData, name: 'Updated Name' });
      expect(auditService.log).toHaveBeenCalledWith({
        action: 'TEMPLATE_UPDATED',
        userId: 'hr-001',
        targetId: 'temp-123',
        targetType: 'ReviewTemplate'
      });
      expect(res.name).toBe('Updated Name');
    });

    it('should delete template successfully and log audit', async () => {
      reviewRepo.deleteTemplate.mockResolvedValue();
      const res = await reviewService.deleteTemplate('temp-123', 'hr-001');
      expect(reviewRepo.deleteTemplate).toHaveBeenCalledWith('temp-123');
      expect(auditService.log).toHaveBeenCalledWith({
        action: 'TEMPLATE_DELETED',
        userId: 'hr-001',
        targetId: 'temp-123',
        targetType: 'ReviewTemplate'
      });
      expect(res).toEqual({ success: true });
    });
  });
});