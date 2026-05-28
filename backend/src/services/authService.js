const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const otplib = require('otplib');
const authenticator = otplib.authenticator || otplib.default?.authenticator || otplib;
const userRepo = require('../repositories/userRepo');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function login({ email, password }) {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    const err = new Error('Invalid email or password format');
    err.status = 400; throw err;
  }

  const user = await userRepo.findByEmail(email);
  if (!user || !user.isActive) {
    const err = new Error(user ? '帳號已停用，請聯絡 HR' : 'Invalid credentials');
    err.status = user && !user.isActive ? 403 : 401; throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.status = 401; throw err;
  }

  if (user.mfaEnabled) {
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, mfaPending: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    return { requiresMfa: true, tempToken };
  }

  return generateFullToken(user);
}

async function verifyMfa({ tempToken, tokenCode }) {
  try {
    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload.mfaPending) throw new Error('Invalid token type');

    const user = await userRepo.findByEmail(payload.email);

    if (!user) {
      const err = new Error('找不到該安全驗證帳號');
      err.status = 404; throw err;
    }

    const isValid = typeof authenticator.verify === 'function'
      ? authenticator.verify({ token: tokenCode, secret: user.mfaSecret })
      : authenticator.check(tokenCode, user.mfaSecret);
      
    if (!isValid) {
      const err = new Error('驗證碼錯誤');
      err.status = 401; throw err;
    }

    return generateFullToken(user);
  } catch (err) {
    err.status = err.status || 401;
    throw err;
  }
}

function generateFullToken(user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, managerId: user.managerId },
  };
}

async function getMe(userId) {
  const user = await userRepo.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    managerId: user.managerId,
    level: user.level,
    departmentId: user.departmentId,
  };
}

module.exports = { login, verifyMfa, getMe };
