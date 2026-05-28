const disputeService = require('../../services/disputeService');
const disputeRepo = require('../../repositories/disputeRepo');
const goalRepo = require('../../repositories/goalRepo');
const userRepo = require('../../repositories/userRepo');
const auditService = require('../../services/auditService');

jest.mock('../../repositories/disputeRepo');
jest.mock('../../repositories/goalRepo');
jest.mock('../../repositories/userRepo');
jest.mock('../../services/auditService');

beforeEach(() => {
  jest.clearAllMocks();
  auditService.log = jest.fn().mockResolvedValue(undefined);
});

describe('disputeService.fileDispute', () => {
  test('validation fail -> throws 400', async () => {
    await expect(disputeService.fileDispute({ goalId: '', reason: '' }, 'emp-1'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('goal not found -> throws 404', async () => {
    goalRepo.findById.mockResolvedValue(null);
    await expect(disputeService.fileDispute({ goalId: 'g1', reason: 'reason' }, 'emp-1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('forbidden goal owner -> throws 403', async () => {
    goalRepo.findById.mockResolvedValue({ id: 'g1', userId: 'emp-2', status: 'REJECTED' });
    await expect(disputeService.fileDispute({ goalId: 'g1', reason: 'reason' }, 'emp-1'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('goal status not REJECTED -> throws 400', async () => {
    goalRepo.findById.mockResolvedValue({ id: 'g1', userId: 'emp-1', status: 'ACTIVE' });
    await expect(disputeService.fileDispute({ goalId: 'g1', reason: 'reason' }, 'emp-1'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('already filed dispute this quarter -> throws 409', async () => {
    goalRepo.findById.mockResolvedValue({ id: 'g1', userId: 'emp-1', status: 'REJECTED', kpi: { quarter: '2026Q2' } });
    disputeRepo.hasDisputeInQuarter.mockResolvedValue(true);

    await expect(disputeService.fileDispute({ goalId: 'g1', reason: 'reason' }, 'emp-1'))
      .rejects.toMatchObject({ status: 409 });
  });

  test('success -> creates dispute, updates status, and logs audit', async () => {
    const goal = { id: 'g1', userId: 'emp-1', status: 'REJECTED', kpi: { quarter: '2026Q2' } };
    const dispute = { id: 'd1', goalId: 'g1', employeeId: 'emp-1', reason: 'reason' };

    goalRepo.findById.mockResolvedValue(goal);
    disputeRepo.hasDisputeInQuarter.mockResolvedValue(false);
    disputeRepo.create.mockResolvedValue(dispute);
    goalRepo.updateStatus.mockResolvedValue({ ...goal, status: 'DISPUTED' });

    const result = await disputeService.fileDispute({ goalId: 'g1', reason: 'reason' }, 'emp-1');

    expect(disputeRepo.create).toHaveBeenCalledWith({ goalId: 'g1', employeeId: 'emp-1', reason: 'reason' });
    expect(goalRepo.updateStatus).toHaveBeenCalledWith('g1', 'DISPUTED');
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'DISPUTE_FILED',
      userId: 'emp-1',
      targetId: 'g1',
      targetType: 'GOAL',
      meta: { disputeId: 'd1', reason: 'reason' }
    });
    expect(result).toEqual(dispute);
  });
});

describe('disputeService.getPendingDisputes', () => {
  test('success -> retrieves disputes', async () => {
    const mockDisputes = [{ id: 'd1' }];
    disputeRepo.findPendingForUpperManager.mockResolvedValue(mockDisputes);

    const result = await disputeService.getPendingDisputes('mgr-1');
    expect(disputeRepo.findPendingForUpperManager).toHaveBeenCalledWith('mgr-1');
    expect(result).toEqual(mockDisputes);
  });
});

describe('disputeService.resolveDispute', () => {
  test('validation fail -> throws 400', async () => {
    await expect(disputeService.resolveDispute('d1', { finalScore: 'invalid' }, 'mgr-1'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('dispute not found -> throws 404', async () => {
    disputeRepo.findById.mockResolvedValue(null);
    await expect(disputeService.resolveDispute('d1', { finalScore: 90 }, 'mgr-1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('dispute not PENDING -> throws 409', async () => {
    disputeRepo.findById.mockResolvedValue({ id: 'd1', status: 'RESOLVED' });
    await expect(disputeService.resolveDispute('d1', { finalScore: 90 }, 'mgr-1'))
      .rejects.toMatchObject({ status: 409 });
  });

  test('direct manager resolves -> throws 403', async () => {
    disputeRepo.findById.mockResolvedValue({
      id: 'd1',
      status: 'PENDING',
      employee: { managerId: 'mgr-1' }
    });
    await expect(disputeService.resolveDispute('d1', { finalScore: 90 }, 'mgr-1'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('not upper manager resolves -> throws 403', async () => {
    disputeRepo.findById.mockResolvedValue({
      id: 'd1',
      status: 'PENDING',
      employee: { managerId: 'mgr-1' }
    });
    userRepo.findById.mockResolvedValue({ id: 'mgr-1', managerId: 'upper-mgr-1' });

    await expect(disputeService.resolveDispute('d1', { finalScore: 90 }, 'other-mgr'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('success -> resolves dispute, updates status, and logs audit', async () => {
    const dispute = {
      id: 'd1',
      status: 'PENDING',
      goalId: 'g1',
      employee: { managerId: 'mgr-1' }
    };
    disputeRepo.findById.mockResolvedValue(dispute);
    userRepo.findById.mockResolvedValue({ id: 'mgr-1', managerId: 'upper-mgr-1' });
    disputeRepo.resolve.mockResolvedValue({ id: 'd1', status: 'RESOLVED' });
    goalRepo.updateStatus.mockResolvedValue({ id: 'g1', status: 'DISPUTE_RESOLVED' });

    const result = await disputeService.resolveDispute('d1', { finalScore: 95 }, 'upper-mgr-1');

    expect(disputeRepo.resolve).toHaveBeenCalledWith('d1', { finalScore: 95, resolvedById: 'upper-mgr-1' });
    expect(goalRepo.updateStatus).toHaveBeenCalledWith('g1', 'DISPUTE_RESOLVED');
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'DISPUTE_RESOLVED',
      userId: 'upper-mgr-1',
      targetId: 'g1',
      targetType: 'GOAL',
      meta: { disputeId: 'd1', finalScore: 95 }
    });
    expect(result).toEqual({ ok: true });
  });
});
