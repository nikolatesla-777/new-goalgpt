/**
 * Phase-3A.1: Admin Routes Tests
 *
 * Tests for admin panel routes with ADMIN_API_KEY authentication
 *
 * Test Coverage:
 * 1. ADMIN_API_KEY authentication guard
 * 2. POST /api/admin/publish-with-audit (with mocked telegram)
 * 3. GET /api/admin/publish-logs
 */

import Fastify, { FastifyInstance } from 'fastify';
import adminRoutes from '../admin.routes';
import pool from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    query: jest.fn(),
  },
}));

describe('Admin Routes - ADMIN_API_KEY Authentication', () => {
  let app: FastifyInstance;
  const VALID_API_KEY = 'test-admin-key-123';
  const INVALID_API_KEY = 'wrong-key';

  beforeAll(async () => {
    // Set ADMIN_API_KEY environment variable
    process.env.ADMIN_API_KEY = VALID_API_KEY;

    // Create Fastify instance
    app = Fastify();

    // Register admin routes
    await app.register(adminRoutes, { prefix: '/api/admin' });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.ADMIN_API_KEY;
  });

  describe('Authentication Guard', () => {
    test('Should reject request without x-admin-api-key header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        payload: {
          market_id: 'O25',
          match_ids: ['12345'],
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toContain('Missing x-admin-api-key');
    });

    test('Should reject request with invalid x-admin-api-key', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': INVALID_API_KEY,
        },
        payload: {
          market_id: 'O25',
          match_ids: ['12345'],
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toContain('Invalid ADMIN_API_KEY');
    });

    test('Should accept request with valid x-admin-api-key', async () => {
      // Mock database operations
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'log-uuid-123' }] }) // INSERT audit log
          .mockResolvedValueOnce({}), // UPDATE audit log
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock fastify.inject for telegram endpoint call
      const originalInject = app.inject.bind(app);
      app.inject = jest.fn().mockImplementation((opts: any) => {
        if (opts.url.includes('/telegram/publish/match/')) {
          return Promise.resolve({
            statusCode: 200,
            body: JSON.stringify({
              telegram_message_id: 'telegram-msg-123',
              channel_id: 'test-channel',
            }),
          });
        }
        return originalInject(opts);
      }) as any;

      const response = await originalInject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
          'content-type': 'application/json',
        },
        payload: {
          market_id: 'O25',
          match_ids: ['12345'],
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.request_id).toBeDefined();
      expect(body.market_id).toBe('O25');

      // Restore inject
      app.inject = originalInject;
    });
  });

  describe('POST /api/admin/publish-with-audit', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('Should reject request without market_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          match_ids: ['12345'],
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('market_id is required');
    });

    test('Should reject request without admin_user_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          market_id: 'O25',
          match_ids: ['12345'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('admin_user_id is required');
    });

    test('Should reject invalid market_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          market_id: 'INVALID_MARKET',
          match_ids: ['12345'],
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid market_id');
      expect(body.valid_markets).toBeDefined();
    });

    test('Should handle DRY_RUN mode successfully', async () => {
      // Mock database operations
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'log-uuid-dry-run' }] }) // INSERT
          .mockResolvedValueOnce({}) // UPDATE to dry_run_success
          .mockResolvedValueOnce({}), // COMMIT
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          market_id: 'BTTS',
          match_ids: ['67890'],
          dry_run: true,
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.dry_run).toBe(true);
      expect(body.status).toBe('dry_run_success');
      expect(body.match_results).toBeDefined();
      expect(Array.isArray(body.match_results)).toBe(true);
    });

    test('Should handle invalid match_id format gracefully', async () => {
      // Mock database operations
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'log-uuid-invalid' }] }) // INSERT
          .mockResolvedValueOnce({}), // UPDATE with error
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          market_id: 'O25',
          match_ids: ['not-a-number'],
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('failed');
      expect(body.match_results[0].status).toBe('failed');
      expect(body.match_results[0].error).toContain('Invalid match_id format');
    });

    test('Should call telegram endpoint for each match_id', async () => {
      // Mock database operations
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 'log-1' }] }) // INSERT log 1
          .mockResolvedValueOnce({}) // UPDATE log 1
          .mockResolvedValueOnce({ rows: [{ id: 'log-2' }] }) // INSERT log 2
          .mockResolvedValueOnce({}), // UPDATE log 2
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      // Mock telegram endpoint calls
      const telegramCalls: any[] = [];
      const originalInject = app.inject.bind(app);
      app.inject = jest.fn().mockImplementation((opts: any) => {
        if (opts.url.includes('/telegram/publish/match/')) {
          telegramCalls.push(opts);
          return Promise.resolve({
            statusCode: 200,
            body: JSON.stringify({
              telegram_message_id: `telegram-msg-${telegramCalls.length}`,
              channel_id: 'test-channel',
            }),
          });
        }
        return originalInject(opts);
      }) as any;

      const response = await originalInject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          market_id: 'O25',
          match_ids: ['11111', '22222'],
          admin_user_id: 'test-admin',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.match_results.length).toBe(2);
      expect(body.match_results[0].status).toBe('sent');
      expect(body.match_results[1].status).toBe('sent');

      // Restore inject
      app.inject = originalInject;
    });
  });

  describe('GET /api/admin/publish-logs', () => {
    test('Should return logs with default pagination', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          request_id: 'req-1',
          admin_user_id: 'admin-1',
          match_id: '12345',
          market_id: 'O25',
          status: 'sent',
          created_at: new Date().toISOString(),
        },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 1 }] }) // COUNT query
        .mockResolvedValueOnce({ rows: mockLogs }); // SELECT query

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/publish-logs',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.logs).toBeDefined();
      expect(body.total).toBe(1);
      expect(body.limit).toBe(100);
      expect(body.offset).toBe(0);
    });

    test('Should filter logs by market_id', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/publish-logs?market_id=BTTS',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.logs).toBeDefined();
    });

    test('Should filter logs by admin_user_id', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/publish-logs?admin_user_id=test-admin',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.logs).toBeDefined();
    });

    test('Should respect limit and offset parameters', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 50 }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/publish-logs?limit=10&offset=20',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(20);
      expect(body.total).toBe(50);
    });

    test('Should enforce max limit of 1000', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ total: 2000 }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/publish-logs?limit=5000', // Request 5000
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(1000); // Should be capped at 1000
    });
  });
});
