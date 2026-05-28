const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

jest.mock('../../services/goalService');
jest.mock('../../services/kpiService');
jest.mock('../../services/authService');
jest.mock('../../services/auditService');

const app = require('../../app');
const goalService = require('../../services/goalService');
const kpiService = require('../../services/kpiService');
const authService = require('../../services/authService');
const auditService = require('../../services/auditService');

function makeToken(role) {
  return jwt.sign(
    { userId: `${role.toLowerCase()}-id`, email: `${role.toLowerCase()}@test.com`, role, name: role },
    process.env.JWT_SECRET
  );
}

const TOKEN_EMP = makeToken('EMPLOYEE');
const TOKEN_MGR = makeToken('MANAGER');
const TOKEN_HR = makeToken('HR');

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('200 — 正確帳密回傳 token', async () => {
    authService.login.mockResolvedValue({
      token: 'jwt-token',
      user: { id: 'u1', email: 'employee@test.com', name: 'Employee', role: 'EMPLOYEE' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('401 — 錯誤密碼被拒絕', async () => {
    const err = new Error('Invalid credentials');
    err.status = 401;
    authService.login.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'employee@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  test('401 — 無 token 被拒絕', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('200 — 有效 token 回傳完整使用者資料（含 managerId）', async () => {
    authService.getMe.mockResolvedValue({
      id: 'manager-id',
      email: 'manager@test.com',
      name: 'Manager',
      role: 'MANAGER',
      managerId: 'upper-mgr-id',
      level: null,
      departmentId: 'dept-a',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: 'MANAGER',
      managerId: 'upper-mgr-id',
    });
    expect(authService.getMe).toHaveBeenCalledWith('manager-id');
  });

  test('200 — upper-manager（無 managerId）回傳 null', async () => {
    authService.getMe.mockResolvedValue({
      id: 'manager-id',
      email: 'upper@test.com',
      name: 'Upper',
      role: 'MANAGER',
      managerId: null,
      level: null,
      departmentId: 'dept-a',
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);

    expect(res.status).toBe(200);
    expect(res.body.managerId).toBeNull();
  });
});


// ─── Goals ────────────────────────────────────────────────────────────────────

describe('GET /api/goals', () => {
  test('401 — 無 token 被拒絕', async () => {
    const res = await request(app).get('/api/goals');
    expect(res.status).toBe(401);
  });

  test('200 — 有效 token 取得目標列表', async () => {
    goalService.getMyGoals.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/goals')
      .set('Authorization', `Bearer ${TOKEN_EMP}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/goals', () => {
  test('403 — MANAGER 無法建立目標', async () => {
    const res = await request(app)
      .post('/api/goals')
      .set('Authorization', `Bearer ${TOKEN_MGR}`)
      .send({ title: '測試目標' });

    expect(res.status).toBe(403);
  });
});

// ─── Team Goals ───────────────────────────────────────────────────────────────

describe('GET /api/goals/team', () => {
  test('403 — EMPLOYEE 無法存取團隊目標', async () => {
    const res = await request(app)
      .get('/api/goals/team')
      .set('Authorization', `Bearer ${TOKEN_EMP}`);

    expect(res.status).toBe(403);
  });

  test('200 — MANAGER 可以存取團隊目標', async () => {
    goalService.getTeamGoals.mockResolvedValue({
      goals: [],
      alignment: { total: 0, aligned: 0, percentage: 0 },
    });

    const res = await request(app)
      .get('/api/goals/team')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('alignment');
  });
});

// ─── Reject Goal ──────────────────────────────────────────────────────────────

describe('PATCH /api/goals/:id/reject', () => {
  test('403 — EMPLOYEE 無法退回目標', async () => {
    const res = await request(app)
      .patch('/api/goals/goal-001/reject')
      .set('Authorization', `Bearer ${TOKEN_EMP}`)
      .send({ reason: '原因' });

    expect(res.status).toBe(403);
  });
});

// ─── KPI ──────────────────────────────────────────────────────────────────────

describe('POST /api/kpis', () => {
  test('403 — EMPLOYEE 無法建立 KPI', async () => {
    const res = await request(app)
      .post('/api/kpis')
      .set('Authorization', `Bearer ${TOKEN_EMP}`)
      .send({ title: '新 KPI', quarter: '2026Q2' });

    expect(res.status).toBe(403);
  });

  test('403 — HR 無法建立 KPI (重構後已無權限)', async () => {
    const res = await request(app)
      .post('/api/kpis')
      .set('Authorization', `Bearer ${TOKEN_HR}`)
      .send({ title: '新 KPI', quarter: '2026Q2' });

    expect(res.status).toBe(403);
  });

  test('201 — MANAGER 可以建立 KPI', async () => {
    kpiService.createKpi.mockResolvedValue({
      id: 'kpi-new',
      title: '新 KPI',
      quarter: '2026Q2',
    });

    const res = await request(app)
      .post('/api/kpis')
      .set('Authorization', `Bearer ${TOKEN_MGR}`)
      .send({ title: '新 KPI', quarter: '2026Q2' });

    expect(res.status).toBe(201);
  });
});

describe('GET /api/kpis', () => {
  test('200 — 呼叫並傳入當前使用者 ID', async () => {
    kpiService.getKpis.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/kpis?quarter=2026Q2')
      .set('Authorization', `Bearer ${TOKEN_EMP}`);

    expect(res.status).toBe(200);
    expect(kpiService.getKpis).toHaveBeenCalledWith('2026Q2', 'employee-id');
  });
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

describe('GET /api/audit-logs', () => {
  test('403 — EMPLOYEE 無法查詢審計日誌', async () => {
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${TOKEN_EMP}`);
    expect(res.status).toBe(403);
  });

  test('403 — MANAGER 無法查詢審計日誌', async () => {
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${TOKEN_MGR}`);
    expect(res.status).toBe(403);
  });

  test('200 — HR 可以成功查詢審計日誌，並可篩選與分頁', async () => {
    auditService.getAuditLogs.mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0
    });

    const res = await request(app)
      .get('/api/audit-logs?page=2&limit=5&action=KPI_CREATED&userId=some-user')
      .set('Authorization', `Bearer ${TOKEN_HR}`);

    expect(res.status).toBe(200);
    expect(auditService.getAuditLogs).toHaveBeenCalledWith({
      page: '2',
      limit: '5',
      action: 'KPI_CREATED',
      userId: 'some-user'
    });
  });
});
