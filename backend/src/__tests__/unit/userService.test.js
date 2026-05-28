const userService = require('../../services/userService');
const userRepo = require('../../repositories/userRepo');
const auditService = require('../../services/auditService');
const bcrypt = require('bcryptjs');

jest.mock('../../repositories/userRepo');
jest.mock('../../services/auditService');
jest.mock('bcryptjs');

beforeEach(() => {
  jest.clearAllMocks();
  auditService.log = jest.fn().mockResolvedValue(undefined);
  bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');
});

describe('userService.listUsers', () => {
  test('HR requestor -> list all users', async () => {
    const requestor = { role: 'HR', userId: 'hr-1' };
    const mockUsers = [{ id: 'u1' }, { id: 'u2' }];
    userRepo.listAll.mockResolvedValue(mockUsers);

    const result = await userService.listUsers(requestor, { role: 'EMPLOYEE' });

    expect(userRepo.listAll).toHaveBeenCalledWith({ departmentId: undefined, role: 'EMPLOYEE', isActive: undefined });
    expect(result).toEqual(mockUsers);
  });

  test('MANAGER requestor -> returns recursive reportIds in same department', async () => {
    const requestor = { role: 'MANAGER', userId: 'mgr-1' };
    const reports = ['emp-1', 'emp-2'];
    userRepo.findAllReportsRecursive.mockResolvedValue(reports);
    userRepo.findById.mockResolvedValue({ id: 'mgr-1', departmentId: 'dep-1' });

    const mockUsers = [
      { id: 'emp-1', departmentId: 'dep-1' },
      { id: 'emp-2', departmentId: 'dep-2' }, // different department, should be filtered out
      { id: 'emp-3', departmentId: 'dep-1' }  // not report, should be filtered out
    ];
    userRepo.listAll.mockResolvedValue(mockUsers);

    const result = await userService.listUsers(requestor);

    expect(result).toEqual([{ id: 'emp-1', departmentId: 'dep-1' }]);
  });

  test('MANAGER requestor with empty reports -> returns empty array', async () => {
    const requestor = { role: 'MANAGER', userId: 'mgr-1' };
    userRepo.findAllReportsRecursive.mockResolvedValue([]);
    userRepo.findById.mockResolvedValue({ id: 'mgr-1', departmentId: 'dep-1' });

    const result = await userService.listUsers(requestor);
    expect(result).toEqual([]);
  });

  test('EMPLOYEE requestor -> throws 403', async () => {
    const requestor = { role: 'EMPLOYEE', userId: 'emp-1' };
    await expect(userService.listUsers(requestor))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe('userService.getUserById', () => {
  test('user not found -> throws 404', async () => {
    userRepo.findById.mockResolvedValue(null);
    await expect(userService.getUserById({ role: 'HR' }, 'u1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('HR requestor -> returns target', async () => {
    const target = { id: 'u1', role: 'EMPLOYEE' };
    userRepo.findById.mockResolvedValue(target);

    const result = await userService.getUserById({ role: 'HR', userId: 'hr-1' }, 'u1');
    expect(result).toEqual(target);
  });

  test('self requestor -> returns target', async () => {
    const target = { id: 'u1', role: 'EMPLOYEE' };
    userRepo.findById.mockResolvedValue(target);

    const result = await userService.getUserById({ role: 'EMPLOYEE', userId: 'u1' }, 'u1');
    expect(result).toEqual(target);
  });

  test('MANAGER requestor target is direct report -> returns target', async () => {
    const target = { id: 'emp-1', role: 'EMPLOYEE' };
    userRepo.findById.mockResolvedValue(target);
    userRepo.findAllReportsRecursive.mockResolvedValue(['emp-1']);

    const result = await userService.getUserById({ role: 'MANAGER', userId: 'mgr-1' }, 'emp-1');
    expect(result).toEqual(target);
  });

  test('MANAGER requestor target is NOT report -> throws 403', async () => {
    const target = { id: 'emp-2', role: 'EMPLOYEE' };
    userRepo.findById.mockResolvedValue(target);
    userRepo.findAllReportsRecursive.mockResolvedValue(['emp-1']);

    await expect(userService.getUserById({ role: 'MANAGER', userId: 'mgr-1' }, 'emp-2'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('other requestor -> throws 403', async () => {
    userRepo.findById.mockResolvedValue({ id: 'u2' });
    await expect(userService.getUserById({ role: 'EMPLOYEE', userId: 'u1' }, 'u2'))
      .rejects.toMatchObject({ status: 403 });
  });
});

describe('userService.createUser', () => {
  test('missing fields -> throws 400', async () => {
    await expect(userService.createUser('hr-1', { name: '' }))
      .rejects.toMatchObject({ status: 400 });
  });

  test('email exists -> throws 409', async () => {
    userRepo.findByEmail.mockResolvedValue({ id: 'existing-1' });
    await expect(userService.createUser('hr-1', { name: 'N', email: 'e', password: 'p', role: 'R' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('success -> hashes password, creates user and logs audit', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    const createdUser = { id: 'u-new', name: 'N', email: 'e', role: 'R' };
    userRepo.createUser.mockResolvedValue(createdUser);

    const result = await userService.createUser('hr-1', {
      name: 'N',
      email: 'e',
      password: 'password123',
      role: 'EMPLOYEE',
      level: 'L1',
      managerId: 'mgr-1',
      departmentId: 'dep-1'
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(userRepo.createUser).toHaveBeenCalledWith({
      name: 'N',
      email: 'e',
      passwordHash: 'hashed-password',
      role: 'EMPLOYEE',
      level: 'L1',
      managerId: 'mgr-1',
      departmentId: 'dep-1'
    });
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'USER_CREATED',
      userId: 'hr-1',
      targetId: 'u-new',
      targetType: 'User',
      meta: { name: 'N', email: 'e', role: 'EMPLOYEE' }
    });
    expect(result).toEqual(createdUser);
  });
});

describe('userService.updateUser', () => {
  test('user not found -> throws 404', async () => {
    userRepo.findById.mockResolvedValue(null);
    await expect(userService.updateUser('hr-1', 'u1', { name: 'N' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('success -> updates user and logs audit', async () => {
    userRepo.findById.mockResolvedValue({ id: 'u1' });
    const updatedUser = { id: 'u1', name: 'N' };
    userRepo.updateUser.mockResolvedValue(updatedUser);

    const result = await userService.updateUser('hr-1', 'u1', {
      name: 'N',
      role: 'MANAGER',
      level: 'L2',
      managerId: 'mgr-2',
      departmentId: 'dep-2'
    });

    expect(userRepo.updateUser).toHaveBeenCalledWith('u1', {
      name: 'N',
      role: 'MANAGER',
      level: 'L2',
      managerId: 'mgr-2',
      departmentId: 'dep-2'
    });
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'USER_UPDATED',
      userId: 'hr-1',
      targetId: 'u1',
      targetType: 'User',
      meta: {
        name: 'N',
        role: 'MANAGER',
        level: 'L2',
        managerId: 'mgr-2',
        departmentId: 'dep-2'
      }
    });
    expect(result).toEqual(updatedUser);
  });
});

describe('userService.deactivateUser', () => {
  test('user not found -> throws 404', async () => {
    userRepo.findById.mockResolvedValue(null);
    await expect(userService.deactivateUser('hr-1', 'u1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('deactivate self -> throws 400', async () => {
    userRepo.findById.mockResolvedValue({ id: 'hr-1' });
    await expect(userService.deactivateUser('hr-1', 'hr-1'))
      .rejects.toMatchObject({ status: 400 });
  });

  test('success -> deactivates and logs audit', async () => {
    userRepo.findById.mockResolvedValue({ id: 'u1', name: 'User 1' });
    userRepo.setActive.mockResolvedValue({ id: 'u1', isActive: false });

    const result = await userService.deactivateUser('hr-1', 'u1');

    expect(userRepo.setActive).toHaveBeenCalledWith('u1', false);
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'USER_DEACTIVATED',
      userId: 'hr-1',
      targetId: 'u1',
      targetType: 'User',
      meta: { name: 'User 1' }
    });
    expect(result).toEqual({ id: 'u1', isActive: false });
  });
});

describe('userService.activateUser', () => {
  test('user not found -> throws 404', async () => {
    userRepo.findById.mockResolvedValue(null);
    await expect(userService.activateUser('hr-1', 'u1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('success -> activates and logs audit', async () => {
    userRepo.findById.mockResolvedValue({ id: 'u1', name: 'User 1' });
    userRepo.setActive.mockResolvedValue({ id: 'u1', isActive: true });

    const result = await userService.activateUser('hr-1', 'u1');

    expect(userRepo.setActive).toHaveBeenCalledWith('u1', true);
    expect(auditService.log).toHaveBeenCalledWith({
      action: 'USER_ACTIVATED',
      userId: 'hr-1',
      targetId: 'u1',
      targetType: 'User',
      meta: { name: 'User 1' }
    });
    expect(result).toEqual({ id: 'u1', isActive: true });
  });
});

describe('userService.listManagers', () => {
  test('success -> lists managers', async () => {
    const managers = [{ id: 'mgr-1' }];
    userRepo.listManagersByDepartment.mockResolvedValue(managers);

    const result = await userService.listManagers('dep-1');
    expect(userRepo.listManagersByDepartment).toHaveBeenCalledWith('dep-1');
    expect(result).toEqual(managers);
  });
});
