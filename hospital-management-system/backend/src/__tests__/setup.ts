// Global test setup
import { prismaMock } from './prismaMock';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Setup global timeout
jest.setTimeout(10000);

// Export prismaMock for use in tests
export { prismaMock };
