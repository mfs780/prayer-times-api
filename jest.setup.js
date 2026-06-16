// Global test setup
global.fetch = jest.fn();

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Setup timezone for consistent date testing.
// NOTE: The date helpers in src/utils/date-formats.ts construct Date objects
// using process-local TZ. Tests assume Pacific. Production should likewise pin
// a representative TZ until those helpers are made timezone-aware.
process.env.TZ = 'America/Los_Angeles';
