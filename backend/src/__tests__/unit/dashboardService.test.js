jest.mock('../../repositories/dashboardRepo');

const dashboardService = require('../../services/dashboardService');
const dashboardRepo = require('../../repositories/dashboardRepo');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MANAGER_ID = 'mgr-001';
const SUB_IDS = ['emp-001', 'emp-002'];

const MOCK_DIRECT_REPORTS = [
  { id: 'emp-001', name: 'Alice', email: 'alice@test.com', role: 'EMPLOYEE' },
  { id: 'emp-002', name: 'Bob',   email: 'bob@test.com',   role: 'EMPLOYEE' },
];

const MOCK_QUARTERS = ['2026Q2', '2026Q1'];

function makeGoal(overrides) {
  return {
    id: 'goal-x',
    userId: 'emp-001',
    progress: 50,
    status: 'ACTIVE',
    kpi: { id: 'kpi-001', title: 'KPI 1', quarter: '2026Q2' },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  dashboardRepo.getAllSubordinateIds.mockResolvedValue(SUB_IDS);
  dashboardRepo.getDirectReports.mockResolvedValue(MOCK_DIRECT_REPORTS);
  dashboardRepo.getAvailableQuarters.mockResolvedValue(MOCK_QUARTERS);
});

// ─── getDashboardSummary ──────────────────────────────────────────────────────

describe('getDashboardSummary', () => {
  test('statusDistribution 正確計算各狀態數量', async () => {
    dashboardRepo.getGoalsForUsers.mockResolvedValue([
      makeGoal({ status: 'ACTIVE' }),
      makeGoal({ id: 'g2', userId: 'emp-002', status: 'COMPLETED', progress: 100 }),
      makeGoal({ id: 'g3', userId: 'emp-001', status: 'REJECTED', progress: 0 }),
    ]);

    const result = await dashboardService.getDashboardSummary(MANAGER_ID);

    expect(result.statusDistribution.ACTIVE).toBe(1);
    expect(result.statusDistribution.COMPLETED).toBe(1);
    expect(result.statusDistribution.REJECTED).toBe(1);
    expect(result.summary.total).toBe(3);
  });

  test('completionRate 計算正確（已完成 / 非退回）', async () => {
    dashboardRepo.getGoalsForUsers.mockResolvedValue([
      makeGoal({ status: 'COMPLETED', progress: 100 }),
      makeGoal({ id: 'g2', status: 'COMPLETED', progress: 100 }),
      makeGoal({ id: 'g3', status: 'ACTIVE', progress: 50 }),
      makeGoal({ id: 'g4', status: 'REJECTED', progress: 0 }),
    ]);

    const result = await dashboardService.getDashboardSummary(MANAGER_ID);

    // 2 COMPLETED out of 3 non-rejected = 67%
    expect(result.summary.completionRate).toBe(67);
  });

  test('progressDistribution 正確分組到四個區間', async () => {
    dashboardRepo.getGoalsForUsers.mockResolvedValue([
      makeGoal({ progress: 10 }),  // 0-25
      makeGoal({ id: 'g2', progress: 40 }), // 26-50
      makeGoal({ id: 'g3', progress: 60 }), // 51-75
      makeGoal({ id: 'g4', progress: 90 }), // 76-100
    ]);

    const result = await dashboardService.getDashboardSummary(MANAGER_ID);

    expect(result.progressDistribution['0-25']).toBe(1);
    expect(result.progressDistribution['26-50']).toBe(1);
    expect(result.progressDistribution['51-75']).toBe(1);
    expect(result.progressDistribution['76-100']).toBe(1);
  });

  test('kpiAlignment 百分比計算正確', async () => {
    dashboardRepo.getGoalsForUsers.mockResolvedValue([
      // Only emp-001 has a non-rejected goal for kpi-001
      makeGoal({ userId: 'emp-001', status: 'ACTIVE' }),
    ]);

    const result = await dashboardService.getDashboardSummary(MANAGER_ID);

    const kpiEntry = result.kpiAlignment.find((k) => k.kpiId === 'kpi-001');
    expect(kpiEntry).toBeDefined();
    // 1 aligned out of 2 subordinates = 50%
    expect(kpiEntry.alignmentRate).toBe(50);
  });

  test('quarter 篩選參數正確傳遞給 dashboardRepo', async () => {
    dashboardRepo.getGoalsForUsers.mockResolvedValue([]);

    await dashboardService.getDashboardSummary(MANAGER_ID, { quarter: '2026Q2' });

    expect(dashboardRepo.getGoalsForUsers).toHaveBeenCalledWith(SUB_IDS, '2026Q2');
  });

  test('空組織（無下屬）→ 回傳安全的空統計', async () => {
    dashboardRepo.getAllSubordinateIds.mockResolvedValue([]);

    const result = await dashboardService.getDashboardSummary(MANAGER_ID);

    expect(result.summary.total).toBe(0);
    expect(result.summary.completionRate).toBe(0);
    expect(result.kpiAlignment).toEqual([]);
    expect(result.teamBreakdown).toEqual([]);
  });

  test('availableQuarters 從 repo 正確回傳', async () => {
    dashboardRepo.getGoalsForUsers.mockResolvedValue([]);

    const result = await dashboardService.getDashboardSummary(MANAGER_ID);

    expect(result.availableQuarters).toEqual(['2026Q2', '2026Q1']);
  });
});

// ─── getDrillDown ─────────────────────────────────────────────────────────────

describe('getDrillDown', () => {
  test('合法 drill-down（目標在階層內）→ 成功回傳統計', async () => {
    // emp-001 is a sub-manager in our fixture
    dashboardRepo.getAllSubordinateIds
      .mockResolvedValueOnce(['emp-001', 'emp-002'])   // authorization check
      .mockResolvedValueOnce([]);                       // getDashboardSummary for emp-001

    dashboardRepo.getGoalsForUsers.mockResolvedValue([]);
    dashboardRepo.getDirectReports.mockResolvedValue([]);

    const result = await dashboardService.getDrillDown(MANAGER_ID, 'emp-001');

    expect(result).toBeDefined();
    expect(result.summary.total).toBe(0);
  });

  test('非授權的 drill-down → 拋出 403', async () => {
    dashboardRepo.getAllSubordinateIds.mockResolvedValue(['emp-001', 'emp-002']);

    await expect(
      dashboardService.getDrillDown(MANAGER_ID, 'outsider-999')
    ).rejects.toMatchObject({ status: 403 });
  });
});
