/**
 * Phase-3B: Admin Routes
 *
 * Admin endpoints with ADMIN_API_KEY authentication.
 * Includes: AI Summary, Bulk Preview, Bulk Publish, Image Generation
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

// Services
import {
  generateSummaryFromMatchId,
  AISummaryRequest,
} from '../services/admin/aiSummaryFormatter.service';
import { generateBulkPreview } from '../services/admin/bulkPreview.service';
import { executeBulkPublish } from '../services/admin/bulkPublish.service';
import {
  generateMatchImage,
  ImageGenerationRequest,
} from '../services/admin/imageGeneration.service';

// Types
import {
  BulkPreviewRequest,
  BulkPublishRequest,
} from '../types/bulkOperations.types';

// ============================================================================
// MIDDLEWARE: ADMIN API KEY AUTHENTICATION
// ============================================================================

async function requireAdminApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-admin-api-key'] as string | undefined;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    return reply.status(500).send({
      error: 'Server configuration error',
      message: 'ADMIN_API_KEY not configured',
    });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid ADMIN_API_KEY. Please provide a valid x-admin-api-key header.',
    });
  }
}

// ============================================================================
// MIDDLEWARE: IP ALLOWLIST (Phase-3B.5)
// ============================================================================

async function checkIPAllowlist(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const allowlistEnv = process.env.ADMIN_IP_ALLOWLIST;

  // If no allowlist is configured, allow all IPs (opt-in security)
  if (!allowlistEnv || allowlistEnv.trim() === '') {
    return;
  }

  const allowedIPs = allowlistEnv.split(',').map((ip) => ip.trim());
  const clientIP = request.ip;

  if (!allowedIPs.includes(clientIP)) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: `IP address ${clientIP} is not in the allowlist`,
    });
  }
}

// ============================================================================
// MIDDLEWARE: RATE LIMITING (Phase-3B.5)
// ============================================================================

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

async function rateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const clientIP = request.ip;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = parseInt(process.env.ADMIN_RATE_LIMIT || '60', 10);

  const record = rateLimitStore.get(clientIP);

  if (!record || now > record.resetAt) {
    // New window
    rateLimitStore.set(clientIP, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (record.count >= maxRequests) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Max ${maxRequests} requests per minute.`,
      retry_after: Math.ceil((record.resetAt - now) / 1000),
    });
  }

  // Increment count
  record.count++;
}

// Cleanup old rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt + 60000) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// ROUTES
// ============================================================================

export default async function adminRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // Apply security middleware to ALL routes in this group
  // Order: Rate Limit → IP Allowlist → API Key Auth
  fastify.addHook('preHandler', rateLimit);
  fastify.addHook('preHandler', checkIPAllowlist);
  fastify.addHook('preHandler', requireAdminApiKey);

  // ==========================================================================
  // PHASE-3B.1: AI MATCH SUMMARY
  // ==========================================================================

  fastify.post<{ Body: AISummaryRequest }>(
    '/ai-summary',
    async (request, reply) => {
      const { match_id, locale = 'tr' } = request.body;

      if (!match_id || typeof match_id !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'match_id is required and must be a string',
        });
      }

      if (locale !== 'tr' && locale !== 'en') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'locale must be either "tr" or "en"',
        });
      }

      const result = await generateSummaryFromMatchId(match_id, locale);

      if (!result.success) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: result.error || 'Failed to generate summary',
          note: 'Week-2A endpoint may not be available yet',
        });
      }

      if (result.data) {
        result.data.match_id = match_id;
      }

      return reply.status(200).send(result);
    }
  );

  // ==========================================================================
  // PHASE-3B.2: BULK PREVIEW
  // ==========================================================================

  fastify.post<{ Body: BulkPreviewRequest }>(
    '/bulk-preview',
    async (request, reply) => {
      const body = request.body;

      // Validate required fields
      if (!body.date_from || !body.date_to) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'date_from and date_to are required',
        });
      }

      if (!Array.isArray(body.markets) || body.markets.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'markets array is required and must not be empty',
        });
      }

      if (!body.filters) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'filters object is required',
        });
      }

      // Validate filters
      const filters = body.filters;
      if (
        typeof filters.min_confidence !== 'number' ||
        filters.min_confidence < 0 ||
        filters.min_confidence > 100
      ) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'filters.min_confidence must be a number between 0 and 100',
        });
      }

      if (
        typeof filters.min_probability !== 'number' ||
        filters.min_probability < 0 ||
        filters.min_probability > 1
      ) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'filters.min_probability must be a number between 0.0 and 1.0',
        });
      }

      // Execute bulk preview
      const result = await generateBulkPreview(body);

      if (!result.success) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: result.error || 'Failed to generate bulk preview',
        });
      }

      return reply.status(200).send(result);
    }
  );

  // ==========================================================================
  // PHASE-3B.2: BULK PUBLISH
  // ==========================================================================

  fastify.post<{ Body: BulkPublishRequest }>(
    '/bulk-publish',
    async (request, reply) => {
      const body = request.body;

      // Validate required fields
      if (!body.admin_user_id || typeof body.admin_user_id !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'admin_user_id is required and must be a string',
        });
      }

      if (typeof body.dry_run !== 'boolean') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'dry_run is required and must be a boolean',
        });
      }

      if (!Array.isArray(body.picks) || body.picks.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'picks array is required and must not be empty',
        });
      }

      // Validate each pick
      for (const pick of body.picks) {
        if (!pick.match_id || !pick.market_id) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Each pick must have match_id and market_id',
          });
        }

        if (pick.locale !== 'tr' && pick.locale !== 'en') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Each pick locale must be either "tr" or "en"',
          });
        }
      }

      // Generate request metadata
      const requestMetadata = {
        request_id: uuidv4(),
        ip_address: request.ip,
        user_agent: request.headers['user-agent'],
      };

      // Execute bulk publish
      const result = await executeBulkPublish(body, requestMetadata);

      if (!result.success) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: result.error || 'Failed to execute bulk publish',
        });
      }

      return reply.status(200).send(result);
    }
  );

  // ==========================================================================
  // PHASE-3B.3: IMAGE GENERATION
  // ==========================================================================

  fastify.post<{ Body: ImageGenerationRequest }>(
    '/generate-image',
    async (request, reply) => {
      const body = request.body;

      // Validate required fields
      if (!body.match_id || typeof body.match_id !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'match_id is required and must be a string',
        });
      }

      if (!body.market_id || typeof body.market_id !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'market_id is required and must be a string',
        });
      }

      if (body.locale !== 'tr' && body.locale !== 'en') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'locale must be either "tr" or "en"',
        });
      }

      if (body.style !== 'story' && body.style !== 'post') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'style must be either "story" or "post"',
        });
      }

      // Generate image
      const result = await generateMatchImage(body);

      if (!result.success) {
        return reply.status(503).send({
          error: 'Service Unavailable',
          message: result.error || 'Failed to generate image',
          note: 'Week-2A endpoint may not be available yet',
        });
      }

      return reply.status(200).send(result);
    }
  );
}
