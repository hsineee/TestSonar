const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

jest.mock('../../services/dashboardService');

const app = require('../../app');
const dashboardService = require('../../services/dashboardService');

function makeToken(role, userId) {
  return jwt.sign(
    { userId: userId || `${role.toLowerCase()}-id`, email: `${role.toLowerCase()}@test.com`, role, name: role },
    process.env.JWT_SECRET
  );
}

const TOKEN_MGR  = makeToken('MANAGER', 'mgr-001');
const TOKEN_EMP  = makeToken('EMPLOYEE', 'emp-001');
const TOKEN_HR   = makeToken('HR', 'hr-001');

const MOCK_SUMMARY = {
  summary: { total: 5, completionRate: 60, avgProgress: 55, overallAlignmentRate: 75 },
  statusDistribution: { ACTIVE: 2, COMPLETED: 3, REJECTED: 0, DISPUTED: 0, DISPUTE_RESOLVED: 0 },
  progressDistribution: { '0-25': 1, '26-50': 1, '51-75': 1, '76-100': 2 },
  kpiAlignment: [{ kpiId: 'kpi-001', kpiTitle: 'KPI 1', quarter: '2026Q2', alignmentRate: 75, goalCount: 3, alignedUsers: 3, totalUsers: 4 }],
  teamBreakdown: [{ userId: 'emp-001', name: 'Alice', role: 'EMPLOYEE', total: 2, completionRate: 100, avgProgress: 100 }],
  availableQuarters: ['2026Q2'],
  selectedQuarter: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/dashboard/summary ───────────────────────────────────────────────

describe('GET /api/dashboard/summary', () => {
  test('401 — 沒有 token 被拒絕', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });

  test('403 — EMPLOYEE 被拒絕存取', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${TOKEN_EMP}`);
    expect(res.status).toBe(403);
  });

  test('403 — HR 被拒絕存取', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${TOKEN_HR}`);
    expect(res.status).toBe(403);
  });

  test('200 — MANAGER 取得完整 Dashboard 資料', async () => {
    dashboardService.getDashboardSummary.mockResolvedValue(MOCK_SUMMARY);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('statusDistribution');
    expect(res.body).toHaveProperty('kpiAlignment');
    expect(res.body).toHaveProperty('teamBreakdown');
    expect(res.body).toHaveProperty('progressDistribution');
    expect(res.body.summary.total).toBe(5);
  });

  test('200 — quarter 參數正確傳遞給 dashboardService', async () => {
    dashboardService.getDashboardSummary.mockResolvedValue(MOCK_SUMMARY);

    const res = await request(app)
      .get('/api/dashboard/summary?quarter=2026Q2')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);

    expect(res.status).toBe(200);
    expect(dashboardService.getDashboardSummary).toHaveBeenCalledWith(
      'mgr-001',
      { quarter: '2026Q2' }
    );
  });
});

// ─── GET /api/dashboard/drilldown/:managerId ──────────────────────────────────

describe('GET /api/dashboard/drilldown/:managerId', () => {
  test('401 — 沒有 token 被拒絕', async () => {
    const res = await request(app).get('/api/dashboard/drilldown/sub-mgr-001');
    expect(res.status).toBe(401);
  });

  test('403 — EMPLOYEE 被拒絕存取', async () => {
    const res = await request(app)
      .get('/api/dashboard/drilldown/sub-mgr-001')
      .set('Authorization', `Bearer ${TOKEN_EMP}`);
    expect(res.status).toBe(403);
  });

  test('200 — MANAGER 成功 drill-down 取得子階層資料', async () => {
    dashboardService.getDrillDown.mockResolvedValue(MOCK_SUMMARY);

    const res = await request(app)
      .get('/api/dashboard/drilldown/sub-mgr-001')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(dashboardService.getDrillDown).toHaveBeenCalledWith(
      'mgr-001',
      'sub-mgr-001',
      { quarter: undefined }
    );
  });

  test('403 — 服務層拒絕非授權 drill-down → HTTP 403', async () => {
    const err = new Error('Not in hierarchy');
    err.status = 403;
    dashboardService.getDrillDown.mockRejectedValue(err);

    const res = await request(app)
      .get('/api/dashboard/drilldown/outsider-999')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);

    expect(res.status).toBe(403);
  });
});
