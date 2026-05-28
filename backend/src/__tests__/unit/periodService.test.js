jest.mock('../../repositories/periodRepo');
jest.mock('../../services/auditService');

const periodService = require('../../services/periodService');
const periodRepo = require('../../repositories/periodRepo');
const auditService = require('../../services/auditService');

describe('Period Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPeriods', () => {
    it('should retrieve all periods from repo', async () => {
      const mockPeriods = [{ id: 'p1', quarter: '2026Q1' }];
      periodRepo.findAll.mockResolvedValue(mockPeriods);

      const res = await periodService.getAllPeriods();
      expect(periodRepo.findAll).toHaveBeenCalled();
      expect(res).toEqual(mockPeriods);
    });
  });

  describe('createPeriod', () => {
    it('should successfully create period and log audit', async () => {
      const mockPeriod = { id: 'p1', quarter: '2026Q1' };
      periodRepo.findUnique.mockResolvedValue(null);
      periodRepo.create.mockResolvedValue(mockPeriod);
      auditService.log.mockResolvedValue();

      const res = await periodService.createPeriod({ quarter: '2026Q1' }, 'hr-001');

      expect(periodRepo.findUnique).toHaveBeenCalledWith('2026Q1');
      expect(periodRepo.create).toHaveBeenCalledWith({ quarter: '2026Q1' });
      expect(auditService.log).toHaveBeenCalledWith({
        action: 'PERIOD_CREATED',
        userId: 'hr-001',
        targetId: 'p1',
        targetType: 'PerformancePeriod',
        meta: { quarter: '2026Q1' },
      });
      expect(res).toEqual(mockPeriod);
    });

    it('should throw error if format is invalid', async () => {
      await expect(
        periodService.createPeriod({ quarter: 'invalid' }, 'hr-001')
      ).rejects.toMatchObject({
        status: 400,
        message: 'Quarter must be in format 2026Q1',
      });
      expect(periodRepo.create).not.toHaveBeenCalled();
    });

    it('should throw error if period already exists', async () => {
      periodRepo.findUnique.mockResolvedValue({ id: 'p1', quarter: '2026Q1' });

      await expect(
        periodService.createPeriod({ quarter: '2026Q1' }, 'hr-001')
      ).rejects.toMatchObject({
        status: 400,
        message: 'Performance period already exists',
      });
      expect(periodRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('deletePeriod', () => {
    it('should successfully delete period and log audit', async () => {
      periodRepo.findById.mockResolvedValue({ id: 'p1', quarter: '2026Q1' });
      periodRepo.delete.mockResolvedValue();
      auditService.log.mockResolvedValue();

      const res = await periodService.deletePeriod('p1', 'hr-001');

      expect(periodRepo.findById).toHaveBeenCalledWith('p1');
      expect(periodRepo.delete).toHaveBeenCalledWith('p1');
      expect(auditService.log).toHaveBeenCalledWith({
        action: 'PERIOD_DELETED',
        userId: 'hr-001',
        targetId: 'p1',
        targetType: 'PerformancePeriod',
        meta: { quarter: '2026Q1' },
      });
      expect(res).toEqual({ success: true });
    });

    it('should throw error if period is not found', async () => {
      periodRepo.findById.mockResolvedValue(null);

      await expect(
        periodService.deletePeriod('nonexistent', 'hr-001')
      ).rejects.toMatchObject({
        status: 404,
        message: 'Performance period not found',
      });
      expect(periodRepo.delete).not.toHaveBeenCalled();
    });
  });
});
