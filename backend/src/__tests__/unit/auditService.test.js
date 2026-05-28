jest.mock('../../repositories/auditRepo');

const auditService = require('../../services/auditService');
const auditRepo = require('../../repositories/auditRepo');

beforeEach(() => jest.clearAllMocks());

describe('auditService.log', () => {
  test('呼叫 auditRepo.log 並傳入正確參數', async () => {
    auditRepo.log.mockResolvedValue({ id: 'log-001' });

    const payload = {
      action: 'GOAL_CREATED',
      userId: 'user-001',
      targetId: 'goal-001',
      targetType: 'GOAL',
      meta: { title: '測試目標' },
    };

    await auditService.log(payload);

    expect(auditRepo.log).toHaveBeenCalledWith(payload);
  });
});

describe('auditService.getAuditLogs', () => {
  test('成功分頁與篩選查詢審計日誌', async () => {
    const mockLogs = [
      { id: 'log-001', action: 'KPI_CREATED', userId: 'user-001', createdAt: new Date() },
    ];
    auditRepo.findAndCount.mockResolvedValue({ logs: mockLogs, total: 1 });

    const result = await auditService.getAuditLogs({
      page: '2',
      limit: '5',
      action: 'KPI_CREATED',
      userId: 'user-001',
    });

    expect(auditRepo.findAndCount).toHaveBeenCalledWith({
      where: {
        action: 'KPI_CREATED',
        userId: 'user-001',
      },
      skip: 5,
      take: 5,
    });

    expect(result).toEqual({
      logs: mockLogs,
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
  });

  test('無傳入參數時使用預設分頁值', async () => {
    auditRepo.findAndCount.mockResolvedValue({ logs: [], total: 0 });

    const result = await auditService.getAuditLogs();

    expect(auditRepo.findAndCount).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      logs: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });
});
