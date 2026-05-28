jest.mock('../../repositories/userRepo');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('otplib', () => ({
  authenticator: {
    verify: jest.fn(),
    check: jest.fn(),
  },
}));
const otplib = require('otplib');

const authService = require('../../services/authService');
const userRepo = require('../../repositories/userRepo');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MOCK_USER = {
  id: 'user-001',
  email: 'employee@test.com',
  passwordHash: '$2b$10$hashed',
  isActive: true,
  name: 'Employee User',
  role: 'EMPLOYEE',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '7d';
});

describe('authService.login', () => {
  test('200 — 正確帳密回傳 token 與 user', async () => {
    userRepo.findByEmail.mockResolvedValue(MOCK_USER);
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('mocked-jwt-token');

    const result = await authService.login({
      email: 'employee@test.com',
      password: 'password123',
    });

    expect(result).toHaveProperty('token', 'mocked-jwt-token');
    expect(result.user).toMatchObject({ email: 'employee@test.com', role: 'EMPLOYEE' });
  });

  test('401 — 使用者不存在', async () => {
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@test.com', password: 'password123' })
    ).rejects.toMatchObject({ status: 401 });
  });

  test('401 — 密碼錯誤', async () => {
    userRepo.findByEmail.mockResolvedValue(MOCK_USER);
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'employee@test.com', password: 'wrong' })
    ).rejects.toMatchObject({ status: 401 });
  });

  test('400 — email 格式錯誤', async () => {
    await expect(
      authService.login({ email: 'notanemail', password: 'password123' })
    ).rejects.toMatchObject({ status: 400 });
    expect(userRepo.findByEmail).not.toHaveBeenCalled();
  });

  test('400 — password 為空', async () => {
    await expect(
      authService.login({ email: 'employee@test.com', password: '' })
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ─── authService.getMe ────────────────────────────────────────────────────────

describe('authService.getMe', () => {
  const MOCK_FULL_USER = {
    id: 'user-001',
    email: 'manager@test.com',
    name: 'Manager Wang',
    role: 'MANAGER',
    managerId: 'upper-mgr-001',
    level: 'Senior',
    departmentId: 'dept-a',
  };

  test('成功回傳使用者資料（含 managerId）', async () => {
    userRepo.findById.mockResolvedValue(MOCK_FULL_USER);

    const result = await authService.getMe('user-001');

    expect(userRepo.findById).toHaveBeenCalledWith('user-001');
    expect(result).toMatchObject({
      id: 'user-001',
      email: 'manager@test.com',
      name: 'Manager Wang',
      role: 'MANAGER',
      managerId: 'upper-mgr-001',
    });
  });

  test('managerId 為 null 的 upper-manager 也能正常回傳', async () => {
    userRepo.findById.mockResolvedValue({
      ...MOCK_FULL_USER,
      managerId: null,
    });

    const result = await authService.getMe('upper-mgr-001');

    expect(result.managerId).toBeNull();
  });

  test('使用者不存在 → 拋出 404', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(authService.getMe('unknown-id')).rejects.toMatchObject({
      status: 404,
      message: 'User not found',
    });
  });
});
// ─── authService.login ─────────────────────────────────────────────
describe('authService.login (MFA 分支)', () => {
  test('200 — 帳號有開啟 MFA，回傳 tempToken', async () => {
    userRepo.findByEmail.mockResolvedValue({ ...MOCK_USER, mfaEnabled: true });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('mocked-temp-token');

    const result = await authService.login({ email: 'employee@test.com', password: 'password123' });

    expect(result.requiresMfa).toBe(true);
    expect(result.tempToken).toBe('mocked-temp-token');
  });
});

// ─── authService.verifyMfa ────────────────────────────────────────────────────
describe('authService.verifyMfa', () => {
  const mockTempToken = 'valid.temp.token';

  test('200 — 成功驗證 MFA 並回傳正式 token', async () => {
    jwt.verify.mockReturnValue({ email: 'employee@test.com', mfaPending: true });
    userRepo.findByEmail.mockResolvedValue({ ...MOCK_USER, mfaSecret: 'secret123' });
    otplib.authenticator.verify.mockReturnValue(true);
    jwt.sign.mockReturnValue('final-token');

    const result = await authService.verifyMfa({ tempToken: mockTempToken, tokenCode: '123456' });

    expect(result.token).toBe('final-token');
    expect(result.user.email).toBe('employee@test.com');
  });

  test('401 — Token 類型錯誤 (沒有 mfaPending)', async () => {
    jwt.verify.mockReturnValue({ email: 'employee@test.com' }); // 缺少 mfaPending

    await expect(authService.verifyMfa({ tempToken: mockTempToken, tokenCode: '123456' }))
      .rejects.toMatchObject({ status: 401 });
  });

  test('404 — 找不到該安全驗證帳號', async () => {
    jwt.verify.mockReturnValue({ email: 'ghost@test.com', mfaPending: true });
    userRepo.findByEmail.mockResolvedValue(null);

    await expect(authService.verifyMfa({ tempToken: mockTempToken, tokenCode: '123456' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('401 — 驗證碼錯誤', async () => {
    jwt.verify.mockReturnValue({ email: 'employee@test.com', mfaPending: true });
    userRepo.findByEmail.mockResolvedValue({ ...MOCK_USER, mfaSecret: 'secret123' });
    otplib.authenticator.verify.mockReturnValue(false);

    await expect(authService.verifyMfa({ tempToken: mockTempToken, tokenCode: '000000' }))
      .rejects.toMatchObject({ status: 401 });
  });
});