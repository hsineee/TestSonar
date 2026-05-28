const { authMiddleware } = require('../../middleware/authMiddleware');
const { requireRole } = require('../../middleware/rbacMiddleware');
const { errorMiddleware } = require('../../middleware/errorMiddleware');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('no authorization header -> returns 401', () => {
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing or invalid Authorization header' });
    expect(next).not.toHaveBeenCalled();
  });

  test('authorization header not starting with Bearer -> returns 401', () => {
    req.headers.authorization = 'Basic token123';
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('invalid token -> returns 401', () => {
    req.headers.authorization = 'Bearer bad-token';
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('valid token -> sets user and calls next', () => {
    req.headers.authorization = 'Bearer good-token';
    const payload = { userId: 'u1', role: 'EMPLOYEE' };
    jwt.verify.mockReturnValue(payload);

    authMiddleware(req, res, next);
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalled();
  });
});

describe('rbacMiddleware.requireRole', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('no user in request -> returns 401', () => {
    const middleware = requireRole('MANAGER');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  test('user has insufficient role -> returns 403', () => {
    req.user = { role: 'EMPLOYEE' };
    const middleware = requireRole('MANAGER');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: insufficient role' });
    expect(next).not.toHaveBeenCalled();
  });

  test('user has allowed role (single role argument) -> calls next', () => {
    req.user = { role: 'MANAGER' };
    const middleware = requireRole('MANAGER');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('user has allowed role (multiple roles) -> calls next', () => {
    req.user = { role: 'HR' };
    const middleware = requireRole('MANAGER', 'HR');
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('errorMiddleware', () => {
  let req, res, next, oldEnv;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    oldEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = oldEnv;
  });

  test('generic error default status 500', () => {
    const err = new Error('Test error');
    errorMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Test error' });
  });

  test('error with specific status and message', () => {
    const err = new Error('Not found');
    err.status = 404;
    errorMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
  });

  test('development environment includes stack trace', () => {
    process.env.NODE_ENV = 'development';
    const err = new Error('Dev error');
    err.stack = 'some stack trace';
    errorMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Dev error',
      stack: 'some stack trace'
    });
  });
});
