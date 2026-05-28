jest.mock('../../repositories/kpiRepo');
jest.mock('../../repositories/userRepo');
jest.mock('../../repositories/periodRepo');
jest.mock('../../services/auditService');

const kpiService = require('../../services/kpiService');
const kpiRepo = require('../../repositories/kpiRepo');
const userRepo = require('../../repositories/userRepo');
const periodRepo = require('../../repositories/periodRepo');
const auditService = require('../../services/auditService');

const MOCK_KPI = { id: 'kpi-001', title: '微服務架構', quarter: '2026Q2' };

beforeEach(() => {
  jest.clearAllMocks();
  auditService.log = jest.fn().mockResolvedValue(undefined);
  periodRepo.findUnique = jest.fn().mockResolvedValue({ id: 'period-001', quarter: '2026Q2' });
});

describe('kpiService.getKpis', () => {
  test('無 userId 參數 → 回傳所有 KPI (後端相容性)', async () => {
    kpiRepo.findAll.mockResolvedValue([MOCK_KPI]);

    const result = await kpiService.getKpis(undefined, undefined);

    expect(kpiRepo.findAll).toHaveBeenCalled();
    expect(result).toEqual([MOCK_KPI]);
  });

  test('無 userId 且有 quarter 參數 → 依季度篩選', async () => {
    kpiRepo.findByQuarter.mockResolvedValue([MOCK_KPI]);

    const result = await kpiService.getKpis('2026Q2', undefined);

    expect(kpiRepo.findByQuarter).toHaveBeenCalledWith('2026Q2');
    expect(result).toEqual([MOCK_KPI]);
  });

  test('使用者不存在 → 拋出 404', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(kpiService.getKpis('2026Q2', 'unknown-user')).rejects.toMatchObject({
      status: 404,
      message: 'User not found',
    });
  });

  test('Employee 查詢 → 只能看到直屬主管的 KPI', async () => {
    const employee = { id: 'emp-001', role: 'EMPLOYEE', managerId: 'mgr-001' };
    userRepo.findById.mockResolvedValue(employee);
    kpiRepo.findAll.mockResolvedValue([MOCK_KPI]);

    const result = await kpiService.getKpis(undefined, 'emp-001');

    expect(userRepo.findById).toHaveBeenCalledWith('emp-001');
    expect(kpiRepo.findAll).toHaveBeenCalledWith(['mgr-001']);
    expect(result).toEqual([MOCK_KPI]);
  });

  test('Employee 無直屬主管 → 看到空陣列', async () => {
    const employee = { id: 'emp-002', role: 'EMPLOYEE', managerId: null };
    userRepo.findById.mockResolvedValue(employee);

    const result = await kpiService.getKpis(undefined, 'emp-002');

    expect(result).toEqual([]);
    expect(kpiRepo.findAll).not.toHaveBeenCalled();
  });

  test('Manager 查詢 → 看到自己建立與其主管建立的 KPI', async () => {
    const manager = { id: 'mgr-001', role: 'MANAGER', managerId: 'upper-mgr-001' };
    userRepo.findById.mockResolvedValue(manager);
    kpiRepo.findAll.mockResolvedValue([MOCK_KPI]);

    const result = await kpiService.getKpis(undefined, 'mgr-001');

    expect(kpiRepo.findAll).toHaveBeenCalledWith(['upper-mgr-001', 'mgr-001']);
    expect(result).toEqual([MOCK_KPI]);
  });

  test('Upper-Manager 查詢 → 只能看到自己建立的 KPI', async () => {
    const upperManager = { id: 'upper-mgr-001', role: 'MANAGER', managerId: null };
    userRepo.findById.mockResolvedValue(upperManager);
    kpiRepo.findAll.mockResolvedValue([MOCK_KPI]);

    const result = await kpiService.getKpis(undefined, 'upper-mgr-001');

    expect(kpiRepo.findAll).toHaveBeenCalledWith(['upper-mgr-001']);
    expect(result).toEqual([MOCK_KPI]);
  });

  test('HR 查詢 → 只能看到空陣列', async () => {
    const hr = { id: 'hr-001', role: 'HR', managerId: null };
    userRepo.findById.mockResolvedValue(hr);

    const result = await kpiService.getKpis(undefined, 'hr-001');

    expect(result).toEqual([]);
    expect(kpiRepo.findAll).not.toHaveBeenCalled();
  });
});

describe('kpiService.createKpi', () => {
  test('成功建立 KPI 並記錄審計日誌', async () => {
    kpiRepo.create.mockResolvedValue(MOCK_KPI);

    const result = await kpiService.createKpi({
      title: '微服務架構',
      quarter: '2026Q2',
      createdById: 'mgr-001',
    });

    expect(kpiRepo.create).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'KPI_CREATED',
      userId: 'mgr-001',
      targetId: 'kpi-001',
      targetType: 'KPI',
      meta: { title: '微服務架構', quarter: '2026Q2' },
    });
    expect(result).toEqual(MOCK_KPI);
  });

  test('quarter 格式錯誤 → 拋出 400', async () => {
    await expect(
      kpiService.createKpi({ title: '新KPI', quarter: 'Q2-2026', createdById: 'mgr-001' })
    ).rejects.toMatchObject({ status: 400 });
    expect(kpiRepo.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  test('title 為空 → 拋出 400', async () => {
    await expect(
      kpiService.createKpi({ title: '', quarter: '2026Q2', createdById: 'mgr-001' })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('quarter 不在 PerformancePeriod 中 → 拋出 400', async () => {
    periodRepo.findUnique.mockResolvedValue(null);

    await expect(
      kpiService.createKpi({ title: '新KPI', quarter: '2026Q2', createdById: 'mgr-001' })
    ).rejects.toMatchObject({
      status: 400,
      message: 'Performance period not found',
    });
    expect(kpiRepo.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
