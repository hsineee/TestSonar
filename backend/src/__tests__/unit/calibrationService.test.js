const calibrationService = require('../../services/calibrationService');
const calibrationRepo = require('../../repositories/calibrationRepo');
const auditService = require('../../services/auditService');

jest.mock('../../repositories/calibrationRepo');
jest.mock('../../services/auditService');

describe('Calibration Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLevelStandards', () => {
    it('應該成功取得所有職級標準', async () => {
      const mockStandards = [{ id: '1', level: 'Junior Engineer', dimensionName: '產出品質達標率', targetValue: 70 }];
      calibrationRepo.getAllLevelStandards.mockResolvedValue(mockStandards);

      const result = await calibrationService.getLevelStandards();

      expect(result).toEqual(mockStandards);
      expect(calibrationRepo.getAllLevelStandards).toHaveBeenCalledTimes(1);
    });
  });

  describe('createLevelStandard (Upsert 邏輯)', () => {
    const mockData = {
      level: 'Junior Engineer',
      dimensionName: '產出品質達標率',
      targetValue: 70
    };
    const mockManagerId = 'mgr-123';

    it('如果標準不存在，應該成功建立新標準並寫入 Audit Log', async () => {
      calibrationRepo.findStandardByLevelAndDimension.mockResolvedValue(null);
      calibrationRepo.createLevelStandard.mockResolvedValue({ id: 'std-999', ...mockData });
      
      await calibrationService.createLevelStandard(mockData, mockManagerId);
      
      expect(calibrationRepo.createLevelStandard).toHaveBeenCalledWith({ ...mockData, setById: mockManagerId });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LEVEL_STANDARD_CREATED',
        targetType: 'LevelStandard'
      }));
    });

    it('如果標準已存在，應該觸發覆蓋更新(Update)而非新增', async () => {
      calibrationRepo.findStandardByLevelAndDimension.mockResolvedValue({ id: 'std-111', ...mockData });
      calibrationRepo.updateLevelStandard.mockResolvedValue({ id: 'std-111', targetValue: 80, setById: mockManagerId });
      
      await calibrationService.createLevelStandard({ ...mockData, targetValue: 80 }, mockManagerId);
      
      expect(calibrationRepo.updateLevelStandard).toHaveBeenCalledWith('std-111', 80, mockManagerId);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LEVEL_STANDARD_UPDATED'
      }));
    });
  });

  describe('deleteLevelStandard (收回邏輯)', () => {
    it('找不到欲收回的標準時，應該拋出 404', async () => {
      calibrationRepo.getStandardById.mockResolvedValue(null);
      await expect(calibrationService.deleteLevelStandard('not-found-id', 'mgr-123'))
        .rejects.toThrow('找不到該職級標準');
    });
    it('若非發布人試圖收回標準，應該拋出權限錯誤', async () => {
      calibrationRepo.getStandardById.mockResolvedValue({ id: 'std-1', setById: 'mgr-OTHER' });
      
      await expect(
        calibrationService.deleteLevelStandard('std-1', 'mgr-123')
      ).rejects.toThrow('權限不足：您只能收回自己發布的標準規則');
    });

    it('發布人本人應該能成功收回標準', async () => {
      calibrationRepo.getStandardById.mockResolvedValue({ id: 'std-1', setById: 'mgr-123', level: 'Junior', dimensionName: 'A' });
      
      await calibrationService.deleteLevelStandard('std-1', 'mgr-123');
      
      expect(calibrationRepo.deleteLevelStandard).toHaveBeenCalledWith('std-1');
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LEVEL_STANDARD_DELETED'
      }));
    });
  });

  describe('getComparisonDashboard (優先權演算法)', () => {
    it('應該正確執行優先權覆蓋(自己的標準 > 其他人最新的標準)並組裝儀表板', async () => {
      const mockManagerId = 'mgr-123';

      calibrationRepo.getAllLevelStandards.mockResolvedValue([
        { id: '1', level: 'Junior Engineer', dimensionName: 'test coverage', targetValue: 90, setById: 'mgr-OTHER', updatedAt: new Date('2026-10-10') },
        { id: '2', level: 'Junior Engineer', dimensionName: 'test coverage', targetValue: 70, setById: mockManagerId, updatedAt: new Date('2026-01-01') }
      ]);
      
      calibrationRepo.getSubordinatesWithReviews.mockResolvedValue([
        {
          id: 'emp-1',
          name: 'Employee Chen',
          level: 'Junior Engineer',
          reviewsReceived: [
            {
              id: 'rev-1',
              feedbacks: [
                { 
                  dimensionName: 'test coverage', 
                  metricType: 'quantitative', 
                  quantScore: 80,
                  gapAnalysis: null 
                }
              ]
            }
          ]
        }
      ]);

      const result = await calibrationService.getComparisonDashboard(mockManagerId);
      
      const emp1 = result[0];
      const quantMetric = emp1.metrics.find(m => m.metricType === 'quantitative');

      expect(quantMetric.targetValue).toBe(70); 

      expect(quantMetric.meetsThreshold).toBe(true); 
    });
    it('優先權演算法：若兩者皆非經理本人的標準，應選擇 updatedAt 較新的一方', async () => {
      const mockManagerId = 'mgr-123';
      
      calibrationRepo.getAllLevelStandards.mockResolvedValue([
        { id: '1', level: 'Junior', dimensionName: 'Bug率', targetValue: 5, setById: 'mgr-A', updatedAt: new Date('2026-01-01') },
        { id: '2', level: 'Junior', dimensionName: 'Bug率', targetValue: 3, setById: 'mgr-B', updatedAt: new Date('2026-06-01') }
      ]);
      
      calibrationRepo.getSubordinatesWithReviews.mockResolvedValue([
        {
          id: 'emp-1',
          level: 'Junior',
          reviewsReceived: [{
            feedbacks: [
              { dimensionName: 'Bug率', metricType: 'quantitative', quantScore: 4, gapAnalysis: null }
            ]
          }]
        }
      ]);

      const result = await calibrationService.getComparisonDashboard(mockManagerId);
      const metric = result[0].metrics[0];
      
      expect(metric.targetValue).toBe(3); 
      expect(metric.meetsThreshold).toBe(true); 
    });
  });
});