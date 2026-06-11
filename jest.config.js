module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/jest.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/\\.worktrees/'],
  modulePathIgnorePatterns: ['/\\.worktrees/'],
  verbose: true,
  forceExit: true,
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(kysely)/)',
  ],
};
