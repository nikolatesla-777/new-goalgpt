/**
 * Auth Middleware Tests
 *
 * Tests for authentication and authorization middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { requireAdmin } from '../auth.middleware';

// Mock the logger to avoid console output during tests
jest.mock('../../utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ send: sendMock });

    mockRequest = {
      user: undefined,
    };

    mockReply = {
      status: statusMock,
      send: sendMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requireAdmin', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    });

    it('should return 403 if user is not admin', async () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        phone: null,
        role: 'user', // Not admin
      };

      await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Admin access required',
      });
    });

    it('should return 403 if user has no role', async () => {
      mockRequest.user = {
        userId: 'user-123',
        email: 'user@example.com',
        phone: null,
        role: undefined,
      };

      await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(sendMock).toHaveBeenCalledWith({
        error: 'FORBIDDEN',
        message: 'Admin access required',
      });
    });

    it('should pass through if user is admin', async () => {
      mockRequest.user = {
        userId: 'admin-123',
        email: 'admin@example.com',
        phone: null,
        role: 'admin',
      };

      const result = await requireAdmin(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should not call status or send - just return undefined (pass through)
      expect(statusMock).not.toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});
