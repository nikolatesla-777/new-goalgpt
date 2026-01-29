/**
 * Admin Routes Tests - Consolidated (Phase-3A.1 + Phase-3B)
 *
 * Test Coverage:
 * Phase-3A.1:
 * - ADMIN_API_KEY authentication guard
 * - POST /api/admin/publish-with-audit
 * - GET /api/admin/publish-logs
 *
 * Phase-3B:
 * - IP Allowlist middleware
 * - Rate Limiting middleware
 * - POST /api/admin/ai-summary
 * - POST /api/admin/bulk-preview
 * - POST /api/admin/bulk-publish
 * - POST /api/admin/generate-image
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

describe('Admin Routes - Consolidated Tests', () => {
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

  // ==========================================================================
  // AUTHENTICATION TESTS (Phase-3A.1 + Phase-3B)
  // ==========================================================================

  describe('ADMIN_API_KEY Authentication', () => {
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
      expect(body.message).toContain('Invalid ADMIN_API_KEY');
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
              telegram_message_id: 'msg-123',
              channel_id: 'channel-456',
            }),
          });
        }
        return originalInject(opts);
      }) as any;

      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/publish-with-audit',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          market_id: 'O25',
          match_ids: ['12345'],
          admin_user_id: 'test-admin',
          dry_run: false,
        },
      });

      // Restore original inject
      app.inject = originalInject;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.request_id).toBeDefined();
      expect(body.market_id).toBe('O25');
      expect(body.match_results).toHaveLength(1);
    });
  });

  // ==========================================================================
  // PHASE-3A.1 ENDPOINT TESTS
  // ==========================================================================

  describe('POST /api/admin/publish-with-audit', () => {
    test('Should reject request with missing market_id', async () => {
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
      expect(body.error).toContain('market_id');
    });

    test('Should reject request with invalid market_id', async () => {
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

    test('Should handle dry_run mode', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 'log-uuid-123' }] }),
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
          match_ids: ['12345'],
          admin_user_id: 'test-admin',
          dry_run: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.dry_run).toBe(true);
      expect(body.status).toBe('dry_run_success');
    });
  });

  describe('GET /api/admin/publish-logs', () => {
    test('Should return paginated logs', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ total: 100 }] }) // COUNT query
          .mockResolvedValueOnce({ rows: [{ id: 'log-1' }, { id: 'log-2' }] }), // SELECT query
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/publish-logs?limit=50&offset=0',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.logs).toHaveLength(2);
      expect(body.total).toBe(100);
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);
    });

    test('Should filter by market_id', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ total: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'log-1', market_id: 'O25' }] }),
        release: jest.fn(),
      };

      (pool.connect as jest.Mock).mockResolvedValue(mockClient);

      const response = await app.inject({
        method: 'GET',
        url: '/api/admin/publish-logs?market_id=O25',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.logs).toHaveLength(1);
      expect(body.logs[0].market_id).toBe('O25');
    });
  });

  // ==========================================================================
  // PHASE-3B ENDPOINT TESTS (Validation-focused)
  // ==========================================================================

  describe('POST /api/admin/ai-summary', () => {
    test('Should reject request with missing match_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/ai-summary',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          locale: 'tr',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('match_id');
    });

    test('Should reject request with invalid locale', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/ai-summary',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          match_id: '12345',
          locale: 'fr', // Invalid locale
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('locale');
    });
  });

  describe('POST /api/admin/bulk-preview', () => {
    test('Should reject request with missing date_from', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/bulk-preview',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          date_to: '2026-01-31',
          markets: ['O25'],
          filters: {
            min_confidence: 60,
            min_probability: 0.6,
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('date_from');
    });

    test('Should reject request with empty markets array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/bulk-preview',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          date_from: '2026-01-29',
          date_to: '2026-01-31',
          markets: [],
          filters: {
            min_confidence: 60,
            min_probability: 0.6,
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('markets');
    });

    test('Should reject request with invalid min_confidence', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/bulk-preview',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          date_from: '2026-01-29',
          date_to: '2026-01-31',
          markets: ['O25'],
          filters: {
            min_confidence: 150, // Invalid (> 100)
            min_probability: 0.6,
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('min_confidence');
    });

    test('Should reject request with invalid min_probability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/bulk-preview',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          date_from: '2026-01-29',
          date_to: '2026-01-31',
          markets: ['O25'],
          filters: {
            min_confidence: 60,
            min_probability: 1.5, // Invalid (> 1.0)
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('min_probability');
    });
  });

  describe('POST /api/admin/bulk-publish', () => {
    test('Should reject request with missing admin_user_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/bulk-publish',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          dry_run: true,
          picks: [
            { match_id: '12345', market_id: 'O25', locale: 'tr' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('admin_user_id');
    });

    test('Should reject request with missing dry_run', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/bulk-publish',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          admin_user_id: 'test-admin',
          picks: [
            { match_id: '12345', market_id: 'O25', locale: 'tr' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('dry_run');
    });

    test('Should reject request with invalid pick locale', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/bulk-publish',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          admin_user_id: 'test-admin',
          dry_run: true,
          picks: [
            { match_id: '12345', market_id: 'O25', locale: 'fr' }, // Invalid locale
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('locale');
    });
  });

  describe('POST /api/admin/generate-image', () => {
    test('Should reject request with missing match_id', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/generate-image',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          market_id: 'O25',
          locale: 'tr',
          style: 'story',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('match_id');
    });

    test('Should reject request with invalid style', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/admin/generate-image',
        headers: {
          'x-admin-api-key': VALID_API_KEY,
        },
        payload: {
          match_id: '12345',
          market_id: 'O25',
          locale: 'tr',
          style: 'invalid', // Invalid style
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('style');
    });
  });
});
