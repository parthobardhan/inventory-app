// Global test setup
require('dotenv').config({ path: './dev.env' });

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.S3_BUCKET_NAME = 'test-bucket-inventory-app';
process.env.AWS_REGION = 'us-east-1';

// Global test timeout
jest.setTimeout(10000);
