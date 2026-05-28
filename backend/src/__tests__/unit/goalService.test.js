jest.mock('../../repositories/goalRepo');
jest.mock('../../repositories/kpiRepo');
jest.mock('../../repositories/userRepo');
jest.mock('../../services/auditService');
jest.mock('../../repositories/auditRepo');

const goalService = require('../../services/goalService');
const goalRepo = require('../../repositories/goalRepo');
const kpiRepo = require('../../repositories/kpiRepo');
const userRepo = require('../../repositories/userRepo');
const auditService = require('../../services/auditService');
const auditRepo = require('../../repositories/auditRepo');

const VALID_GOAL_DATA = {
  title: '完成技術分享',
  specific: '準備微服務簡報',
  measurable: '30 頁簡報，出席超過 10 人',
  achievable: '每週五下午 2 小時',
  relevant: '對應本季 KPI：微服務架構',
  dueDate: '2026-06-30T00:00:00.000Z',
  kpiId: 'kpi-001',
};

const MOCK_KPI = { id: 'kpi-001', title: 'KPI 1', quarter: '2026Q2' };

const MOCK_GOAL = {
  id: 'goal-001',
  ...VALID_GOAL_DATA,
  userId: 'user-001',
  status: 'ACTIVE',
  progress: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  auditService.log = jest.fn().mockResolvedValue(undefined);
});

// ─── createGoal ───────────────────────────────────────────────────────────────

describe('createGoal', () => {
  test('成功建立目標並寫 Audit Log', async () => {
    kpiRepo.findById.mockResolvedValue(MOCK_KPI);
    goalRepo.create.mockResolvedValue(MOCK_GOAL);

    const result = await goalService.createGoal(VALID_GOAL_DATA, 'user-001');

    expect(goalRepo.create).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GOAL_CREATED', userId: 'user-001' })
    );
    expect(result).toEqual(MOCK_GOAL);
  });

  test('KPI 不存在 → 拋出 404', async () => {
    kpiRepo.findById.mockResolvedValue(null);

    await expect(goalService.createGoal(VALID_GOAL_DATA, 'user-001')).rejects.toMatchObject({
      status: 404,
      message: 'KPI not found',
    });
    expect(goalRepo.create).not.toHaveBeenCalled();
  });

  test('缺少 specific 欄位 → 拋出 400', async () => {
    const bad = { ...VALID_GOAL_DATA, specific: '' };

    await expect(goalService.createGoal(bad, 'user-001')).rejects.toMatchObject({ status: 400 });
    expect(kpiRepo.findById).not.toHaveBeenCalled();
  });

  test('dueDate 格式錯誤 → 拋出 400', async () => {
    const bad = { ...VALID_GOAL_DATA, dueDate: 'not-a-date' };

    await expect(goalService.createGoal(bad, 'user-001')).rejects.toMatchObject({ status: 400 });
  });
});

// ─── updateProgress ───────────────────────────────────────────────────────────

describe('updateProgress', () => {
  test('進度 60 → status 維持 ACTIVE', async () => {
    goalRepo.findById.mockResolvedValue(MOCK_GOAL);
    goalRepo.updateProgress.mockResolvedValue({ ...MOCK_GOAL, progress: 60, status: 'ACTIVE' });

    const result = await goalService.updateProgress('goal-001', { progress: 60 }, 'user-001');

    expect(result.status).toBe('ACTIVE');
    expect(result.progress).toBe(60);
  });

  test('進度 100 → status 自動變 COMPLETED', async () => {
    goalRepo.findById.mockResolvedValue(MOCK_GOAL);
    goalRepo.updateProgress.mockResolvedValue({ ...MOCK_GOAL, progress: 100, status: 'COMPLETED' });

    const result = await goalService.updateProgress('goal-001', { progress: 100 }, 'user-001');

    expect(result.status).toBe('COMPLETED');
  });

  test('進度超過 100 → 拋出 400', async () => {
    await expect(
      goalService.updateProgress('goal-001', { progress: 101 }, 'user-001')
    ).rejects.toMatchObject({ status: 400 });
  });

  test('進度小於 0 → 拋出 400', async () => {
    await expect(
      goalService.updateProgress('goal-001', { progress: -1 }, 'user-001')
    ).rejects.toMatchObject({ status: 400 });
  });

  test('非擁有者 → 拋出 403', async () => {
    goalRepo.findById.mockResolvedValue(MOCK_GOAL); // userId = 'user-001'

    await expect(
      goalService.updateProgress('goal-001', { progress: 50 }, 'user-999')
    ).rejects.toMatchObject({ status: 403 });
  });

  test('目標不存在 → 拋出 404', async () => {
    goalRepo.findById.mockResolvedValue(null);

    await expect(
      goalService.updateProgress('goal-xxx', { progress: 50 }, 'user-001')
    ).rejects.toMatchObject({ status: 404 });
  });

  test('REJECTED 目標不能更新進度 → 拋出 400', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, status: 'REJECTED' });

    await expect(
      goalService.updateProgress('goal-001', { progress: 50 }, 'user-001')
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ─── rejectGoal ───────────────────────────────────────────────────────────────

describe('rejectGoal', () => {
  test('成功退回直屬員工目標並寫 Audit Log', async () => {
    goalRepo.findById.mockResolvedValue(MOCK_GOAL);
    userRepo.isDirectReport.mockResolvedValue(true);
    goalRepo.reject.mockResolvedValue({ ...MOCK_GOAL, status: 'REJECTED', rejectReason: '原因' });

    const result = await goalService.rejectGoal('goal-001', { reason: '原因' }, 'mgr-001');

    expect(result.status).toBe('REJECTED');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GOAL_REJECTED', userId: 'mgr-001' })
    );
  });

  test('非直屬員工 → 拋出 403', async () => {
    goalRepo.findById.mockResolvedValue(MOCK_GOAL);
    userRepo.isDirectReport.mockResolvedValue(false);

    await expect(
      goalService.rejectGoal('goal-001', { reason: '原因' }, 'other-mgr')
    ).rejects.toMatchObject({ status: 403 });
    expect(goalRepo.reject).not.toHaveBeenCalled();
  });

  test('目標不存在 → 拋出 404', async () => {
    goalRepo.findById.mockResolvedValue(null);

    await expect(
      goalService.rejectGoal('goal-xxx', { reason: '原因' }, 'mgr-001')
    ).rejects.toMatchObject({ status: 404 });
  });

  test('退回理由為空 → 拋出 400', async () => {
    await expect(
      goalService.rejectGoal('goal-001', { reason: '' }, 'mgr-001')
    ).rejects.toMatchObject({ status: 400 });
    expect(goalRepo.findById).not.toHaveBeenCalled();
  });
});

// ─── getTeamGoals ─────────────────────────────────────────────────────────────

describe('getTeamGoals', () => {
  test('alignment 計算：2 個下屬，1 人有目標 → 50%', async () => {
    goalRepo.findByManagerId.mockResolvedValue([
      { ...MOCK_GOAL, userId: 'emp-001', status: 'ACTIVE' },
    ]);
    userRepo.findReportsByManagerId.mockResolvedValue([
      { id: 'emp-001' },
      { id: 'emp-002' },
    ]);

    const result = await goalService.getTeamGoals('mgr-001');

    expect(result.alignment.total).toBe(2);
    expect(result.alignment.aligned).toBe(1);
    expect(result.alignment.percentage).toBe(50);
  });

  test('沒有下屬 → percentage = 0', async () => {
    goalRepo.findByManagerId.mockResolvedValue([]);
    userRepo.findReportsByManagerId.mockResolvedValue([]);

    const result = await goalService.getTeamGoals('mgr-001');

    expect(result.alignment.percentage).toBe(0);
  });
});

describe('deleteDraft', () => {
  test('成功刪除 draft 且寫入 Audit Log', async () => {
    const mockGoal = { id: 'goal-002', userId: 'user-001', status: 'DRAFT', title: '草稿目標' };
    goalRepo.findById.mockResolvedValue(mockGoal);
    goalRepo.deleteById.mockResolvedValue({ id: 'goal-002' });

    await goalService.deleteDraft('goal-002', 'user-001');

    expect(goalRepo.deleteById).toHaveBeenCalledWith('goal-002');
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'GOAL_DRAFT_DELETED',
      userId: 'user-001',
      targetId: 'goal-002',
      targetType: 'GOAL',
      meta: { title: '草稿目標' },
    });
  });

  test('目標不存在 → 拋出 404', async () => {
    goalRepo.findById.mockResolvedValue(null);

    await expect(goalService.deleteDraft('goal-xxx', 'user-001')).rejects.toMatchObject({
      status: 404,
      message: 'Goal not found',
    });
  });

  test('非擁有者 → 拋出 403', async () => {
    const mockGoal = { id: 'goal-002', userId: 'user-001', status: 'DRAFT', title: '草稿目標' };
    goalRepo.findById.mockResolvedValue(mockGoal);

    await expect(goalService.deleteDraft('goal-002', 'user-999')).rejects.toMatchObject({
      status: 403,
      message: 'You can only delete your own goals',
    });
  });

  test('不是 DRAFT 狀態的目標 → 拋出 400', async () => {
    const mockGoal = { id: 'goal-002', userId: 'user-001', status: 'ACTIVE', title: '非草稿目標' };
    goalRepo.findById.mockResolvedValue(mockGoal);

    await expect(goalService.deleteDraft('goal-002', 'user-001')).rejects.toMatchObject({
      status: 400,
      message: 'Only draft goals can be deleted',
    });
  });
});

describe('updateDraft', () => {
  test('成功更新 draft 且寫入 Audit Log', async () => {
    const mockGoal = { id: 'goal-002', userId: 'user-001', status: 'DRAFT', title: '舊標題' };
    const updateData = {
      title: '新標題',
      specific: 'S',
      measurable: 'M',
      achievable: 'A',
      relevant: 'R',
      dueDate: '2026-06-30T00:00:00.000Z',
      kpiId: 'kpi-001',
    };
    
    goalRepo.findById.mockResolvedValue(mockGoal);
    kpiRepo.findById.mockResolvedValue({ id: 'kpi-001' });
    goalRepo.updateDraft.mockResolvedValue({ ...mockGoal, title: '新標題' });

    const result = await goalService.updateDraft('goal-002', updateData, 'user-001');

    expect(goalRepo.updateDraft).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'GOAL_DRAFT_UPDATED',
      userId: 'user-001',
      targetId: 'goal-002',
      targetType: 'GOAL',
      meta: { title: '新標題' },
    });
    expect(result.title).toBe('新標題');
  });

  test('目標不存在 → 拋出 404', async () => {
    goalRepo.findById.mockResolvedValue(null);

    await expect(
      goalService.updateDraft('goal-xxx', {
        title: '新標題',
        specific: 'S',
        measurable: 'M',
        achievable: 'A',
        relevant: 'R',
        dueDate: '2026-06-30T00:00:00.000Z',
        kpiId: 'kpi-001',
      }, 'user-001')
    ).rejects.toMatchObject({
      status: 404,
      message: 'Goal not found',
    });
  });
});

describe('getMyGoals', () => {
  test('成功取得使用者所有目標', async () => {
    const mockGoals = [{ id: 'goal-001' }];
    goalRepo.findByUserId.mockResolvedValue(mockGoals);

    const result = await goalService.getMyGoals('user-001');

    expect(goalRepo.findByUserId).toHaveBeenCalledWith('user-001');
    expect(result).toEqual(mockGoals);
  });
});

describe('submitGoal', () => {
  test('目標不存在 → 拋出 404', async () => {
    goalRepo.findById.mockResolvedValue(null);

    await expect(goalService.submitGoal('goal-xxx', 'user-001')).rejects.toMatchObject({
      status: 404,
      message: 'Goal not found',
    });
  });

  test('非擁有者 → 拋出 403', async () => {
    const mockGoal = { id: 'goal-001', userId: 'user-002', status: 'DRAFT' };
    goalRepo.findById.mockResolvedValue(mockGoal);

    await expect(goalService.submitGoal('goal-001', 'user-001')).rejects.toMatchObject({
      status: 403,
      message: 'You can only submit your own goals',
    });
  });

  test('不是 DRAFT 狀態的目標 → 拋出 400', async () => {
    const mockGoal = { id: 'goal-001', userId: 'user-001', status: 'ACTIVE' };
    goalRepo.findById.mockResolvedValue(mockGoal);

    await expect(goalService.submitGoal('goal-001', 'user-001')).rejects.toMatchObject({
      status: 400,
      message: 'Only draft goals can be submitted',
    });
  });

  test('成功提交目標且寫入 Audit Log', async () => {
    const mockGoal = { id: 'goal-001', userId: 'user-001', status: 'DRAFT', title: '目標' };
    goalRepo.findById.mockResolvedValue(mockGoal);
    goalRepo.updateStatus.mockResolvedValue({ ...mockGoal, status: 'ACTIVE' });

    const result = await goalService.submitGoal('goal-001', 'user-001');

    expect(goalRepo.updateStatus).toHaveBeenCalledWith('goal-001', 'ACTIVE');
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'GOAL_SUBMITTED',
      userId: 'user-001',
      targetId: 'goal-001',
      targetType: 'GOAL',
      meta: { title: '目標' },
    });
    expect(result.status).toBe('ACTIVE');
  });
});

// ─── 補充：updateProgress 邊界條件 ─────────────────────────────────────────────
describe('updateProgress (補充邊界條件)', () => {
  test('DISPUTED 狀態目標不能更新進度 → 拋出 400', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, status: 'DISPUTED' });
    await expect(goalService.updateProgress('goal-001', { progress: 50 }, 'user-001'))
      .rejects.toMatchObject({ status: 400 });
  });
});

// ─── 補充：rejectGoal 邊界條件 ────────────────────────────────────────────────
describe('rejectGoal (補充邊界條件)', () => {
  test('已經是 REJECTED 狀態 → 拋出 400', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, status: 'REJECTED' });
    userRepo.isDirectReport.mockResolvedValue(true);
    await expect(goalService.rejectGoal('goal-001', { reason: '原因' }, 'mgr-001'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('處於 DISPUTED 狀態不能退回 → 拋出 400', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, status: 'DISPUTED' });
    userRepo.isDirectReport.mockResolvedValue(true);
    await expect(goalService.rejectGoal('goal-001', { reason: '原因' }, 'mgr-001'))
      .rejects.toMatchObject({ status: 400 });
  });
});

// ─── 補充：updateDraft 邊界條件 ───────────────────────────────────────────────
describe('updateDraft (補充邊界條件)', () => {
  const updateData = {
    title: '新標題', specific: 'S', measurable: 'M', achievable: 'A', relevant: 'R', dueDate: '2026-06-30T00:00:00.000Z', kpiId: 'kpi-001'
  };

  test('非擁有者 → 拋出 403', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, status: 'DRAFT', userId: 'user-001' });
    await expect(goalService.updateDraft('goal-002', updateData, 'user-999'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('不是 DRAFT 狀態 → 拋出 400', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, status: 'ACTIVE' });
    await expect(goalService.updateDraft('goal-002', updateData, 'user-001'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('KPI 不存在 → 拋出 404', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, status: 'DRAFT' });
    kpiRepo.findById.mockResolvedValue(null);
    await expect(goalService.updateDraft('goal-002', updateData, 'user-001'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('傳入資料格式錯誤 → 拋出 400', async () => {
    await expect(goalService.updateDraft('goal-002', { title: '' }, 'user-001'))
      .rejects.toMatchObject({ status: 400 });
  });
});

// ─── getGoalProgressLogs ──────────────────────────────────────────────────────
describe('getGoalProgressLogs', () => {

  test('成功取得進度更新日誌', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, userId: 'user-001' });
    auditRepo.findByTargetId.mockResolvedValue([
      { action: 'GOAL_PROGRESS_UPDATED', meta: { to: 50 } },
      { action: 'OTHER_ACTION' }
    ]);

    const logs = await goalService.getGoalProgressLogs('goal-001', 'user-001');
    expect(logs.length).toBe(1);
    expect(logs[0].action).toBe('GOAL_PROGRESS_UPDATED');
  });

  test('目標不存在 → 拋出 404', async () => {
    goalRepo.findById.mockResolvedValue(null);
    await expect(goalService.getGoalProgressLogs('goal-xxx', 'user-001'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('非擁有者 → 拋出 403', async () => {
    goalRepo.findById.mockResolvedValue({ ...MOCK_GOAL, userId: 'user-001' });
    await expect(goalService.getGoalProgressLogs('goal-001', 'user-999'))
      .rejects.toMatchObject({ status: 403 });
  });
});