// backend/src/__tests__/__mocks__/otplibMock.js
module.exports = {
  authenticator: {
    verify: jest.fn().mockReturnValue(true),
    generate: jest.fn().mockReturnValue('123456'),
  },
};