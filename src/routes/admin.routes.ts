/**
 * admin.routes.ts
 *
 * Admin-only routes protected by ADMIN_API_KEY header authentication.
 * Phase-3A.1: Publishing with audit logging
 *
 * Security: All routes require x-admin-api-key header matching ADMIN_API_KEY env var
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import pool from '../database/pool';

// ============================================================================
// TYPES
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
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Require ADMIN_API_KEY header for all admin routes
 */
async function requireAdminApiKey(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-admin-api-key'] as string | undefined;
  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    request.log.error('ADMIN_API_KEY not configured in environment');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Admin authentication not configured'
    });
  }

  if (!apiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing x-admin-api-key header'
    });
  }

  if (apiKey !== expectedKey) {
    request.log.warn({ provided_key_prefix: apiKey.substring(0, 8) }, 'Invalid ADMIN_API_KEY attempt');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid ADMIN_API_KEY'
    });
  }

  // Authentication successful
  request.log.info('Admin API key authenticated');
}

// ============================================================================
// HELPER FUNCTIONS
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
// ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/admin/publish-with-audit
 *
 * Publish predictions to Telegram with full audit logging.
 *
 * Body:
 * {
 *   market_id: string (e.g., "O25", "BTTS")
 *   match_ids?: string[] (optional, for single match publishes)
 *   locale?: "tr" | "en" (default: "tr")
 *   dry_run?: boolean (default: false)
 *   message_overrides?: { title?: string, notes?: string }
 *   admin_user_id: string (identifier for audit trail)
 * }
 *
 * Response:
 * {
 *   request_id: string
 *   market_id: string
 *   dry_run: boolean
 *   status: "sent" | "failed" | "dry_run_success"
 *   match_results: Array<{ match_id, status, telegram_message_id?, error? }>
 * }
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
 *
 * Query params:
 * - market_id (optional): Filter by market
 * - admin_user_id (optional): Filter by admin user
 * - status (optional): Filter by status (sent|failed|dry_run_success)
 * - limit (optional): Max results (default: 100, max: 1000)
 * - offset (optional): Pagination offset (default: 0)
 *
 * Response:
 * {
 *   logs: PublishLog[]
 *   total: number
 *   limit: number
 *   offset: number
 * }
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

export default async function adminRoutes(fastify: FastifyInstance) {
  // Add authentication hook to all routes
  fastify.addHook('onRequest', requireAdminApiKey);

  // POST /api/admin/publish-with-audit
  fastify.post('/publish-with-audit', handlePublishWithAudit);

  // GET /api/admin/publish-logs
  fastify.get('/publish-logs', handleGetPublishLogs);
}
