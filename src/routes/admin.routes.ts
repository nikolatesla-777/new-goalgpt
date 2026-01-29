/**
 * Admin Routes - Consolidated (Phase-3A.1 + Phase-3B)
 *
 * Admin endpoints with comprehensive security and audit logging.
 *
 * Phase-3A.1: Publishing with audit logging
 * - POST /api/admin/publish-with-audit
 * - GET /api/admin/publish-logs
 *
 * Phase-3B: Advanced admin operations
 * - POST /api/admin/ai-summary
 * - POST /api/admin/bulk-preview
 * - POST /api/admin/bulk-publish
 * - POST /api/admin/generate-image
 *
 * Security: All routes protected by middleware chain:
 * - Rate Limiting (60 req/min per IP, configurable via ADMIN_RATE_LIMIT)
 * - IP Allowlist (opt-in via ADMIN_IP_ALLOWLIST)
 * - API Key Authentication (x-admin-api-key header)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../database/connection';

// Phase-3B Services
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

// Phase-3B Types
import {
  BulkPreviewRequest,
  BulkPublishRequest,
} from '../types/bulkOperations.types';

// ============================================================================
// TYPES (Phase-3A.1)
// ============================================================================

interface PublishWithAuditRequest {
  market_id: string;
  match_ids?: string[];
  locale?: 'tr' | 'en';
  dry_run?: boolean;
  message_overrides?: {
    title?: string;
    notes?: string;
  };
  admin_user_id: string;
}

interface PublishResult {
  request_id: string;
  market_id: string;
  dry_run: boolean;
  status: 'sent' | 'failed' | 'dry_run_success';
  telegram_message_id?: string;
  channel_id?: string;
  error?: string;
  match_results: Array<{
    match_id: string;
    status: 'sent' | 'failed' | 'dry_run_success';
    telegram_message_id?: string;
    error?: string;
  }>;
}

interface PublishLog {
  id: string;
  request_id: string;
  admin_user_id: string;
  match_id: string;
  fs_match_id: number | null;
  market_id: string;
  channel_id: string | null;
  payload: any;
  dry_run: boolean;
  status: string;
  telegram_message_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// ============================================================================
// MIDDLEWARE: RATE LIMITING (Phase-3B)
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
// MIDDLEWARE: IP ALLOWLIST (Phase-3B)
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
// MIDDLEWARE: ADMIN API KEY AUTHENTICATION (Phase-3A.1 + Phase-3B)
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
// HELPER FUNCTIONS (Phase-3A.1)
// ============================================================================

/**
 * Call telegram publish endpoint for single match
 */
async function callTelegramPublishMatch(
  fsMatchId: number,
  marketId: string,
  dryRun: boolean,
  fastify: FastifyInstance
): Promise<{ telegram_message_id?: string; channel_id?: string; error?: string }> {
  try {
    // Call POST /telegram/publish/match/:fsMatchId
    const response = await fastify.inject({
      method: 'POST',
      url: `/telegram/publish/match/${fsMatchId}`,
      payload: {
        match_id: fsMatchId,
        picks: [{ market_type: marketId }]
      },
      headers: {
        'content-type': 'application/json'
      }
    });

    if (response.statusCode !== 200) {
      const body = JSON.parse(response.body);
      return { error: body.error || `HTTP ${response.statusCode}` };
    }

    const result = JSON.parse(response.body);

    if (dryRun) {
      return {
        telegram_message_id: 'DRY_RUN_MESSAGE_ID',
        channel_id: result.channel_id || 'DRY_RUN_CHANNEL'
      };
    }

    return {
      telegram_message_id: result.telegram_message_id,
      channel_id: result.channel_id
    };

  } catch (error) {
    fastify.log.error({ error, fsMatchId, marketId }, 'Error calling telegram publish endpoint');
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Persist publish action to audit log
 */
async function persistPublishLog(
  requestId: string,
  adminUserId: string,
  matchId: string,
  fsMatchId: number | null,
  marketId: string,
  channelId: string | null,
  payload: any,
  dryRun: boolean,
  status: 'sent' | 'failed' | 'dry_run_success',
  telegramMessageId: string | null,
  errorMessage: string | null
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO admin_publish_logs (
        request_id, admin_user_id, match_id, fs_match_id, market_id,
        channel_id, payload, dry_run, status, telegram_message_id,
        error_message, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        requestId,
        adminUserId,
        matchId,
        fsMatchId,
        marketId,
        channelId,
        JSON.stringify(payload),
        dryRun,
        status,
        telegramMessageId,
        errorMessage
      ]
    );
  } finally {
    client.release();
  }
}

// ============================================================================
// ROUTE HANDLERS (Phase-3A.1)
// ============================================================================

/**
 * POST /api/admin/publish-with-audit
 *
 * Publish predictions to Telegram with full audit logging.
 */
async function handlePublishWithAudit(
  request: FastifyRequest<{ Body: PublishWithAuditRequest }>,
  reply: FastifyReply
) {
  const requestId = uuidv4();
  const startTime = Date.now();

  try {
    const {
      market_id,
      match_ids = [],
      locale = 'tr',
      dry_run = false,
      message_overrides,
      admin_user_id
    } = request.body;

    // Validation
    if (!market_id) {
      return reply.status(400).send({ error: 'market_id is required' });
    }

    if (!admin_user_id) {
      return reply.status(400).send({ error: 'admin_user_id is required' });
    }

    const validMarkets = ['O25', 'BTTS', 'HT_O05', 'O35', 'HOME_O15', 'CORNERS_O85', 'CARDS_O25'];
    if (!validMarkets.includes(market_id)) {
      return reply.status(400).send({
        error: 'Invalid market_id',
        valid_markets: validMarkets
      });
    }

    request.log.info({
      request_id: requestId,
      market_id,
      match_count: match_ids.length,
      dry_run,
      admin_user_id
    }, 'Publishing with audit');

    // Process each match
    const matchResults: Array<{
      match_id: string;
      status: 'sent' | 'failed' | 'dry_run_success';
      telegram_message_id?: string;
      error?: string;
    }> = [];

    for (const matchId of match_ids) {
      const fsMatchId = parseInt(matchId, 10);

      if (isNaN(fsMatchId)) {
        request.log.warn({ match_id: matchId }, 'Invalid match_id format, skipping');
        matchResults.push({
          match_id: matchId,
          status: 'failed',
          error: 'Invalid match_id format'
        });
        await persistPublishLog(
          requestId,
          admin_user_id,
          matchId,
          null,
          market_id,
          null,
          { market_id, locale, message_overrides },
          dry_run,
          'failed',
          null,
          'Invalid match_id format'
        );
        continue;
      }

      // Call telegram publish endpoint
      const publishResult = await callTelegramPublishMatch(
        fsMatchId,
        market_id,
        dry_run,
        request.server
      );

      if (publishResult.error) {
        // Failed
        matchResults.push({
          match_id: matchId,
          status: 'failed',
          error: publishResult.error
        });

        await persistPublishLog(
          requestId,
          admin_user_id,
          matchId,
          fsMatchId,
          market_id,
          null,
          { market_id, locale, message_overrides },
          dry_run,
          'failed',
          null,
          publishResult.error
        );
      } else {
        // Success
        const status = dry_run ? 'dry_run_success' : 'sent';
        matchResults.push({
          match_id: matchId,
          status,
          telegram_message_id: publishResult.telegram_message_id
        });

        await persistPublishLog(
          requestId,
          admin_user_id,
          matchId,
          fsMatchId,
          market_id,
          publishResult.channel_id || null,
          { market_id, locale, message_overrides },
          dry_run,
          status,
          publishResult.telegram_message_id || null,
          null
        );
      }
    }

    // Determine overall status
    const allSuccess = matchResults.every(r => r.status !== 'failed');
    const overallStatus = dry_run ? 'dry_run_success' : (allSuccess ? 'sent' : 'failed');

    const duration = Date.now() - startTime;
    request.log.info({
      request_id: requestId,
      duration_ms: duration,
      status: overallStatus,
      match_count: matchResults.length
    }, 'Publish with audit completed');

    return reply.status(200).send({
      request_id: requestId,
      market_id,
      dry_run,
      status: overallStatus,
      match_results: matchResults
    });

  } catch (error) {
    request.log.error({ error, request_id: requestId }, 'Error in publish-with-audit');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      request_id: requestId
    });
  }
}

/**
 * GET /api/admin/publish-logs
 *
 * Retrieve audit logs for admin publishes.
 */
async function handleGetPublishLogs(
  request: FastifyRequest<{
    Querystring: {
      market_id?: string;
      admin_user_id?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  try {
    const {
      market_id,
      admin_user_id,
      status,
      limit = '100',
      offset = '0'
    } = request.query;

    const limitNum = Math.min(parseInt(limit, 10) || 100, 1000);
    const offsetNum = parseInt(offset, 10) || 0;

    // Build query
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (market_id) {
      conditions.push(`market_id = $${paramIndex++}`);
      params.push(market_id);
    }

    if (admin_user_id) {
      conditions.push(`admin_user_id = $${paramIndex++}`);
      params.push(admin_user_id);
    }

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const client = await pool.connect();
    try {
      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM admin_publish_logs ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total, 10);

      // Get logs
      const logsResult = await client.query(
        `SELECT * FROM admin_publish_logs
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limitNum, offsetNum]
      );

      return reply.status(200).send({
        logs: logsResult.rows,
        total,
        limit: limitNum,
        offset: offsetNum
      });

    } finally {
      client.release();
    }

  } catch (error) {
    request.log.error({ error }, 'Error fetching publish logs');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// ROUTE REGISTRATION
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
  // PHASE-3A.1: PUBLISHING WITH AUDIT LOGGING
  // ==========================================================================

  fastify.post('/publish-with-audit', handlePublishWithAudit);
  fastify.get('/publish-logs', handleGetPublishLogs);

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
