/**
 * Jest Test Setup
 * Global configuration for all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock JWT secrets for testing
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-testing';

// Increase timeout for async operations
jest.setTimeout(10000);

// Global beforeAll/afterAll hooks
beforeAll(async () => {
  // Setup before all tests
});

afterAll(async () => {
  // Cleanup after all tests
});
