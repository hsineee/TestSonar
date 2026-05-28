const dailyOutputService = require('../../services/dailyOutputService');
const dailyOutputRepo = require('../../repositories/dailyOutputRepo');
const userRepo = require('../../repositories/userRepo');
const auditService = require('../../services/auditService');

jest.mock('../../repositories/dailyOutputRepo');
jest.mock('../../repositories/userRepo');
jest.mock('../../services/auditService');

beforeEach(() => {
  jest.clearAllMocks();
  auditService.log = jest.fn().mockResolvedValue(undefined);
});

describe('dailyOutputService.getTags', () => {
  test('success -> returns active tags', async () => {
    const tags = [{ id: 't1', code: 'CODE1', name: 'Tag 1' }];
    dailyOutputRepo.findActiveTags.mockResolvedValue(tags);

    const result = await dailyOutputService.getTags();
    expect(dailyOutputRepo.findActiveTags).toHaveBeenCalled();
    expect(result).toEqual(tags);
  });
});

describe('dailyOutputService.createLog', () => {
  test('validation fail -> throws 400', async () => {
    await expect(dailyOutputService.createLog({ tagId: '', value: -5, logDate: '2026-99-99' }, 'u1'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('tag not found -> throws 404', async () => {
    dailyOutputRepo.findTagById.mockResolvedValue(null);
    await expect(dailyOutputService.createLog({ tagId: 't1', value: 10, logDate: '2026-05-21' }, 'u1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('tag inactive -> throws 404', async () => {
    dailyOutputRepo.findTagById.mockResolvedValue({ id: 't1', isActive: false });
    await expect(dailyOutputService.createLog({ tagId: 't1', value: 10, logDate: '2026-05-21' }, 'u1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('success -> creates log and records audit log', async () => {
    const tag = { id: 't1', code: 'T1', name: 'Tag 1', unit: 'pcs', isActive: true };
    const createdLog = { id: 'l1', userId: 'u1', tagId: 't1', value: 15, logDate: new Date('2026-05-21T00:00:00.000Z') };
    dailyOutputRepo.findTagById.mockResolvedValue(tag);
    dailyOutputRepo.createLog.mockResolvedValue(createdLog);

    const result = await dailyOutputService.createLog({
      tagId: 't1',
      value: 15,
      logDate: '2026-05-21',
      note: 'My note'
    }, 'u1');

    expect(dailyOutputRepo.createLog).toHaveBeenCalledWith({
      userId: 'u1',
      tagId: 't1',
      value: 15,
      logDate: new Date('2026-05-21T00:00:00.000Z'),
      note: 'My note'
    });
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'DAILY_OUTPUT_LOG_CREATED',
      userId: 'u1',
      targetId: 'l1',
      targetType: 'DailyOutputLog',
      meta: {
        tagCode: 'T1',
        tagName: 'Tag 1',
        value: 15,
        unit: 'pcs',
        logDate: '2026-05-21'
      }
    });
    expect(result).toEqual(createdLog);
  });
});

describe('dailyOutputService.listMyLogs', () => {
  test('validation fail -> throws 400', async () => {
    await expect(dailyOutputService.listMyLogs('u1', { from: 'bad-date' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('success -> returns logs with default dates', async () => {
    const logs = [{ id: 'l1' }];
    dailyOutputRepo.findLogsByUserId.mockResolvedValue(logs);

    const result = await dailyOutputService.listMyLogs('u1');

    expect(dailyOutputRepo.findLogsByUserId).toHaveBeenCalledWith('u1', {
      from: expect.any(Date),
      to: undefined
    });
    expect(result).toEqual(logs);
  });

  test('success -> returns logs with custom to date', async () => {
    const logs = [{ id: 'l1' }];
    dailyOutputRepo.findLogsByUserId.mockResolvedValue(logs);

    const result = await dailyOutputService.listMyLogs('u1', { from: '2026-05-01', to: '2026-05-20' });

    expect(dailyOutputRepo.findLogsByUserId).toHaveBeenCalledWith('u1', {
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-20T23:59:59.999Z')
    });
    expect(result).toEqual(logs);
  });
});

describe('dailyOutputService.deleteMyLog', () => {
  test('log not found -> throws 404', async () => {
    dailyOutputRepo.findLogById.mockResolvedValue(null);
    await expect(dailyOutputService.deleteMyLog('l1', 'u1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('not owner -> throws 403', async () => {
    dailyOutputRepo.findLogById.mockResolvedValue({ id: 'l1', userId: 'u2' });
    await expect(dailyOutputService.deleteMyLog('l1', 'u1'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('success -> deletes log and records audit log', async () => {
    const log = {
      id: 'l1',
      userId: 'u1',
      value: 10,
      logDate: new Date('2026-05-21T00:00:00.000Z'),
      tag: { code: 'T1' }
    };
    dailyOutputRepo.findLogById.mockResolvedValue(log);
    dailyOutputRepo.deleteLog.mockResolvedValue({ id: 'l1' });

    const result = await dailyOutputService.deleteMyLog('l1', 'u1');

    expect(dailyOutputRepo.deleteLog).toHaveBeenCalledWith('l1');
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'DAILY_OUTPUT_LOG_DELETED',
      userId: 'u1',
      targetId: 'l1',
      targetType: 'DailyOutputLog',
      meta: { tagCode: 'T1', value: 10, logDate: '2026-05-21' }
    });
    expect(result).toEqual({ ok: true });
  });
});

describe('dailyOutputService.getMyWeeklyReport', () => {
  test('validation fail -> throws 400', async () => {
    await expect(dailyOutputService.getMyWeeklyReport('u1', { weekStart: 'bad' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('success -> builds weekly report', async () => {
    const tags = [{ id: 't1', code: 'T1', name: 'Tag 1', unit: 'pcs' }];
    const logs = [
      {
        id: 'l1',
        userId: 'u1',
        tagId: 't1',
        value: 10,
        logDate: new Date('2026-05-21T00:00:00.000Z'),
        tag: { id: 't1', code: 'T1', name: 'Tag 1', unit: 'pcs' }
      }
    ];

    dailyOutputRepo.findActiveTags.mockResolvedValue(tags);
    dailyOutputRepo.findLogsByUserId.mockResolvedValue(logs);

    const result = await dailyOutputService.getMyWeeklyReport('u1', { weekStart: '2026-05-18' });

    expect(result).toHaveProperty('weekStart', '2026-05-18');
    expect(result).toHaveProperty('weekEnd', '2026-05-24');
    expect(result.totalEntries).toBe(1);
    expect(result.byTag[0].total).toBe(10);
  });
});

describe('dailyOutputService.getTeamWeeklyReport', () => {
  test('validation fail -> throws 400', async () => {
    await expect(dailyOutputService.getTeamWeeklyReport({ role: 'HR' }, { weekStart: 'bad' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('HR requestor -> retrieves all active users weekly report except HRs', async () => {
    const tags = [{ id: 't1', code: 'T1', name: 'Tag 1', unit: 'pcs' }];
    const users = [
      { id: 'u1', name: 'User 1', email: 'u1@t.com', role: 'EMPLOYEE' },
      { id: 'hr-1', name: 'HR 1', email: 'hr@t.com', role: 'HR' }
    ];
    const logs = [
      {
        id: 'l1',
        userId: 'u1',
        tagId: 't1',
        value: 12.5,
        logDate: new Date('2026-05-21T00:00:00.000Z'),
        user: { name: 'User 1', email: 'u1@t.com', role: 'EMPLOYEE' }
      }
    ];

    dailyOutputRepo.findActiveTags.mockResolvedValue(tags);
    userRepo.listAll.mockResolvedValue(users);
    dailyOutputRepo.findLogsByUserIds.mockResolvedValue(logs);

    const result = await dailyOutputService.getTeamWeeklyReport({ role: 'HR', userId: 'hr-1' }, { weekStart: '2026-05-18' });

    expect(userRepo.listAll).toHaveBeenCalledWith({ isActive: true });
    expect(dailyOutputRepo.findLogsByUserIds).toHaveBeenCalledWith(['u1'], {
      from: new Date('2026-05-18T00:00:00.000Z'),
      to: expect.any(Date)
    });
    expect(result.users[0].userId).toBe('u1');
    expect(result.users[0].totalEntries).toBe(1);
  });

  test('MANAGER requestor -> reports recursive list in same department', async () => {
    const tags = [{ id: 't1', code: 'T1', name: 'Tag 1', unit: 'pcs' }];
    dailyOutputRepo.findActiveTags.mockResolvedValue(tags);
    userRepo.findById.mockResolvedValue({ id: 'mgr-1', departmentId: 'dep-1' });
    userRepo.findAllReportsRecursive.mockResolvedValue(['emp-1']);
    
    const candidates = [
      { id: 'emp-1', departmentId: 'dep-1', isActive: true, name: 'E1', email: 'e1@t.com', role: 'EMPLOYEE' },
      { id: 'emp-2', departmentId: 'dep-2', isActive: true, name: 'E2', email: 'e2@t.com', role: 'EMPLOYEE' }
    ];
    userRepo.listAll.mockResolvedValue(candidates);
    dailyOutputRepo.findLogsByUserIds.mockResolvedValue([]);

    const result = await dailyOutputService.getTeamWeeklyReport({ role: 'MANAGER', userId: 'mgr-1' }, { weekStart: '2026-05-18' });

    expect(userRepo.findAllReportsRecursive).toHaveBeenCalledWith('mgr-1');
    expect(result.users[0].userId).toBe('emp-1');
  });

  test('MANAGER requestor with no reports -> returns empty report', async () => {
    const tags = [{ id: 't1', code: 'T1', name: 'Tag 1', unit: 'pcs' }];
    dailyOutputRepo.findActiveTags.mockResolvedValue(tags);
    userRepo.findById.mockResolvedValue({ id: 'mgr-1', departmentId: 'dep-1' });
    userRepo.findAllReportsRecursive.mockResolvedValue([]);

    const result = await dailyOutputService.getTeamWeeklyReport({ role: 'MANAGER', userId: 'mgr-1' }, { weekStart: '2026-05-18' });

    expect(result.users).toEqual([]);
  });
});
