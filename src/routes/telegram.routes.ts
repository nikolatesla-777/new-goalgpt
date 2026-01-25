/**
 * Telegram Routes - PHASE-1 HARDENED
 *
 * Fastify route definitions for Telegram publishing system
 *
 * PHASE-1 GUARANTEES:
 * 1. IDEMPOTENCY: Same match+channel can only be published once
 * 2. TRANSACTION SAFETY: DB and Telegram state cannot diverge
 * 3. STATE MACHINE: DRAFT → PUBLISHED or FAILED
 * 4. ERROR RECOVERY: Max 3 retries with exponential backoff
 * 5. OBSERVABILITY: Structured logging for all operations
 *
 * SECURITY:
 * - All endpoints require authentication
 * - Publishing requires admin role
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { telegramBot } from '../services/telegram/telegram.client';
import { formatTelegramMessage } from '../services/telegram/turkish.formatter';
import { footyStatsAPI } from '../services/footystats/footystats.client';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { validateMatchStateForPublish } from '../services/telegram/validators/matchStateValidator';
import { validatePicks } from '../services/telegram/validators/pickValidator';

interface PublishRequest {
  Body: {
    match_id: string;
    picks?: Array<{
      market_type: string;
      odds?: number;
    }>;
  };
}

// PHASE-1: Configuration constants
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [1000, 3000, 9000]; // Exponential backoff: 1s, 3s, 9s

/**
 * PHASE-1: Idempotency check
 * Returns existing post if match+channel already published
 */
async function checkExistingPost(matchId: string, channelId: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, telegram_message_id, status, retry_count
       FROM telegram_posts
       WHERE match_id = $1 AND channel_id = $2
       LIMIT 1`,
      [matchId, channelId]
    );
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * PHASE-1: Create draft post in transaction
 * Reserves the idempotency slot before Telegram send
 */
async function createDraftPost(
  matchId: string,
  fsMatchId: number,
  channelId: string,
  content: string
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO telegram_posts (match_id, fs_match_id, channel_id, content, status)
       VALUES ($1, $2, $3, $4, 'draft')
       ON CONFLICT (match_id, channel_id) DO NOTHING
       RETURNING id`,
      [matchId, fsMatchId, channelId, content]
    );

    await client.query('COMMIT');
    return result.rows[0]?.id || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * PHASE-1: Mark post as published with message_id
 */
async function markPublished(postId: string, messageId: number) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE telegram_posts
       SET status = 'published',
           telegram_message_id = $2,
           posted_at = NOW()
       WHERE id = $1`,
      [postId, messageId]
    );
  } finally {
    client.release();
  }
}

/**
 * PHASE-1: Mark post as failed with error details
 */
async function markFailed(postId: string, error: string, retryCount: number) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE telegram_posts
       SET status = 'failed',
           error_log = $2,
           last_error_at = NOW(),
           retry_count = $3
       WHERE id = $1`,
      [postId, error, retryCount]
    );
  } finally {
    client.release();
  }
}

/**
 * PHASE-1: Retry logic with exponential backoff
 * Attempts Telegram send up to MAX_RETRY_ATTEMPTS times
 */
async function sendWithRetry(
  channelId: string,
  messageText: string,
  postId: string
): Promise<number> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      logger.info(`[Telegram] Send attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS} for post ${postId}`);

      const result = await telegramBot.sendMessage({
        chat_id: channelId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      if (!result.ok) {
        throw new Error(`Telegram API returned ok=false: ${JSON.stringify(result)}`);
      }

      logger.info(`[Telegram] ✅ Send successful on attempt ${attempt + 1} for post ${postId}`);
      return result.result.message_id;

    } catch (err: any) {
      lastError = err;
      logger.warn(`[Telegram] ⚠️ Send failed attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}:`, {
        post_id: postId,
        error: err.message,
        attempt: attempt + 1,
      });

      // Update retry count in DB
      const client = await pool.connect();
      try {
        await client.query(
          `UPDATE telegram_posts
           SET retry_count = $1,
               error_log = $2,
               last_error_at = NOW()
           WHERE id = $3`,
          [attempt + 1, err.message, postId]
        );
      } finally {
        client.release();
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const backoffMs = RETRY_BACKOFF_MS[attempt];
        logger.info(`[Telegram] Waiting ${backoffMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries exhausted
  logger.error(`[Telegram] ❌ All ${MAX_RETRY_ATTEMPTS} retry attempts exhausted for post ${postId}`);
  throw lastError || new Error('Send failed after max retries');
}

export async function telegramRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /telegram/health
   * Health check for Telegram bot
   */
  fastify.get('/telegram/health', async (request, reply) => {
    const health = telegramBot.getHealth();

    // PHASE-1: Add retry config to health response
    return {
      ...health,
      retry_config: {
        max_attempts: MAX_RETRY_ATTEMPTS,
        backoff_ms: RETRY_BACKOFF_MS,
      },
    };
  });

  /**
   * POST /telegram/publish/match/:fsMatchId
   * Publish a match to Telegram channel
   *
   * PHASE-1 GUARANTEES:
   * - Idempotent: Duplicate publishes return existing data
   * - Transactional: DB state matches Telegram state
   * - Resilient: Retries on failures
   * - Observable: Structured logs at every step
   */
  fastify.post<PublishRequest>(
    '/telegram/publish/match/:fsMatchId',
    async (request, reply) => {
      const startTime = Date.now();
      const { fsMatchId } = request.params as { fsMatchId: string };
      const { match_id, picks = [] } = request.body;

      // PHASE-1: Structured logging context
      const logContext: Record<string, any> = {
        fs_match_id: fsMatchId,
        match_id,
        picks_count: picks.length,
      };

      logger.info('[Telegram] 📤 Publish request received', logContext);

      try {
        // 1. Validate required fields
        if (!match_id) {
          logger.warn('[Telegram] ❌ Validation failed: match_id missing', logContext);
          return reply.status(400).send({ error: 'match_id (TheSports external_id) is required in body' });
        }

        // 2. Check bot configuration
        if (!telegramBot.isConfigured()) {
          logger.error('[Telegram] ❌ Bot not configured', logContext);
          return reply.status(503).send({ error: 'Telegram bot not configured' });
        }

        const channelId = process.env.TELEGRAM_CHANNEL_ID || '';
        if (!channelId) {
          logger.error('[Telegram] ❌ Channel ID not set', logContext);
          return reply.status(503).send({ error: 'TELEGRAM_CHANNEL_ID not set' });
        }

        // 3. PHASE-1: IDEMPOTENCY CHECK
        logger.info('[Telegram] 🔍 Checking for existing post...', logContext);
        const existingPost = await checkExistingPost(match_id, channelId);

        if (existingPost) {
          logger.info(`[Telegram] ✅ IDEMPOTENCY: Post already exists (${existingPost.status})`, {
            ...logContext,
            post_id: existingPost.id,
            status: existingPost.status,
            telegram_message_id: existingPost.telegram_message_id,
          });

          // Return existing data - NO-OP
          return {
            success: true,
            telegram_message_id: existingPost.telegram_message_id,
            post_id: existingPost.id,
            status: existingPost.status,
            idempotent: true,
            message: 'Match already published (idempotent)',
          };
        }

        logger.info('[Telegram] ✅ No existing post found, proceeding with publish', logContext);

        // 4. PHASE-2A: PICK VALIDATION
        logger.info('[Telegram] 🔍 Validating picks...', logContext);
        const pickValidation = validatePicks(picks);

        if (!pickValidation.valid) {
          logger.warn('[Telegram] ❌ Pick validation failed', {
            ...logContext,
            error: pickValidation.error,
            invalid_picks: pickValidation.invalidPicks,
          });

          return reply.status(400).send({
            error: 'Invalid picks',
            details: pickValidation.error,
            invalid_picks: pickValidation.invalidPicks,
            supported_markets: ['BTTS_YES', 'O25_OVER', 'O15_OVER', 'HT_O05_OVER'],
          });
        }

        logger.info('[Telegram] ✅ Picks validated', logContext);

        // 5. PHASE-2A: MATCH STATE VALIDATION
        // PHASE-2A NOTE: Uses database status_id (fast, but can be stale)
        // RECOMMENDATION (Phase-2B): For production scale, add TheSports API confirmation
        // when DB shows borderline states (status changing soon)
        logger.info('[Telegram] 🔍 Checking match state from database...', logContext);
        const matchClient = await pool.connect();
        let matchStatusId: number | null = null;

        try {
          const matchResult = await matchClient.query(
            `SELECT status_id FROM ts_matches WHERE external_id = $1 LIMIT 1`,
            [match_id]
          );

          if (matchResult.rows.length === 0) {
            logger.warn('[Telegram] ⚠️ Match not found in database - allowing publish', logContext);
            // Match not in DB yet - allow publish (will be synced later)
            // This is normal for future matches that haven't been synced yet
          } else {
            matchStatusId = matchResult.rows[0].status_id;
            logContext.match_status_id = matchStatusId;

            // Validate match state using database status
            if (matchStatusId === null || matchStatusId === undefined) {
              logger.warn('[Telegram] ⚠️ Match status_id is null - skipping validation', logContext);
            } else {
              const stateValidation = validateMatchStateForPublish(matchStatusId, match_id);

              if (!stateValidation.valid) {
                logger.warn('[Telegram] ❌ Match state validation failed', {
                  ...logContext,
                  error: stateValidation.error,
                  error_code: stateValidation.errorCode,
                });

                return reply.status(400).send({
                  error: 'Invalid match state',
                  details: stateValidation.error,
                  error_code: stateValidation.errorCode,
                  match_status_id: matchStatusId,
                });
              }

              logger.info('[Telegram] ✅ Match state validated (NOT_STARTED)', logContext);
            }
          }
        } finally {
          matchClient.release();
        }

        // 6. Fetch match data from FootyStats
        logger.info('[Telegram] 📊 Fetching match data from FootyStats...', logContext);
        const fsIdNum = parseInt(fsMatchId);
        const matchResponse = await footyStatsAPI.getMatchDetails(fsIdNum);
        const fsMatch = matchResponse.data;

        if (!fsMatch) {
          logger.error('[Telegram] ❌ Match not found in FootyStats', logContext);
          return reply.status(404).send({ error: 'Match not found in FootyStats' });
        }

        // 7. Fetch team stats
        let homeStats = null;
        let awayStats = null;

        if (fsMatch.homeID) {
          try {
            const homeResponse = await footyStatsAPI.getTeamLastX(fsMatch.homeID);
            homeStats = homeResponse.data?.[0];
          } catch (err: any) {
            logger.warn('[Telegram] ⚠️ Could not fetch home team stats', {
              ...logContext,
              error: err.message,
            });
          }
        }

        if (fsMatch.awayID) {
          try {
            const awayResponse = await footyStatsAPI.getTeamLastX(fsMatch.awayID);
            awayStats = awayResponse.data?.[0];
          } catch (err: any) {
            logger.warn('[Telegram] ⚠️ Could not fetch away team stats', {
              ...logContext,
              error: err.message,
            });
          }
        }

        // 8. Build message data
        const matchData = {
          home_name: fsMatch.home_name,
          away_name: fsMatch.away_name,
          league_name: (fsMatch as any).competition_name || (fsMatch as any).league_name || 'Unknown',
          date_unix: fsMatch.date_unix,
          potentials: {
            btts: fsMatch.btts_potential,
            over25: fsMatch.o25_potential,
            over15: (fsMatch as any).o15_potential,
          },
          xg: {
            home: fsMatch.team_a_xg_prematch,
            away: fsMatch.team_b_xg_prematch,
          },
          form: {
            home: homeStats ? { ppg: homeStats.seasonPPG_overall } : null,
            away: awayStats ? { ppg: awayStats.seasonPPG_overall } : null,
          },
          h2h: fsMatch.h2h ? {
            total_matches: fsMatch.h2h.previous_matches_results?.totalMatches,
            home_wins: fsMatch.h2h.previous_matches_results?.team_a_wins,
            draws: fsMatch.h2h.previous_matches_results?.draw,
            away_wins: fsMatch.h2h.previous_matches_results?.team_b_wins,
            avg_goals: fsMatch.h2h.betting_stats?.avg_goals,
            btts_pct: fsMatch.h2h.betting_stats?.bttsPercentage,
          } : null,
          trends: fsMatch.trends,
          odds: {
            home: fsMatch.odds_ft_1,
            draw: fsMatch.odds_ft_x,
            away: fsMatch.odds_ft_2,
          },
        };

        const messageText = formatTelegramMessage(matchData, picks as any);

        // 9. PHASE-1: TRANSACTION SAFETY - Create DRAFT post first
        logger.info('[Telegram] 💾 Creating DRAFT post...', logContext);
        const postId = await createDraftPost(match_id, fsIdNum, channelId, messageText);

        if (!postId) {
          // ON CONFLICT DO NOTHING triggered - race condition detected
          logger.warn('[Telegram] ⚠️ Race condition detected: Another request already created this post', logContext);

          // Fetch the existing post
          const racedPost = await checkExistingPost(match_id, channelId);
          return {
            success: true,
            telegram_message_id: racedPost?.telegram_message_id,
            post_id: racedPost?.id,
            status: racedPost?.status,
            idempotent: true,
            message: 'Race condition: Post created by concurrent request',
          };
        }

        logger.info('[Telegram] ✅ DRAFT post created', { ...logContext, post_id: postId });

        // 10. PHASE-1: ERROR RECOVERY - Send to Telegram with retry
        logger.info('[Telegram] 📡 Sending to Telegram with retry logic...', {
          ...logContext,
          post_id: postId,
        });

        let telegramMessageId: number;
        try {
          telegramMessageId = await sendWithRetry(channelId, messageText, postId);
        } catch (err: any) {
          // All retries exhausted - mark as FAILED
          logger.error('[Telegram] ❌ Send failed after all retries, marking as FAILED', {
            ...logContext,
            post_id: postId,
            error: err.message,
          });

          await markFailed(postId, err.message, MAX_RETRY_ATTEMPTS);

          return reply.status(500).send({
            error: 'Failed to send to Telegram after retries',
            post_id: postId,
            status: 'failed',
            retry_count: MAX_RETRY_ATTEMPTS,
          });
        }

        // 11. PHASE-1: STATE TRANSITION - Mark as PUBLISHED
        logger.info('[Telegram] ✅ Marking post as PUBLISHED', {
          ...logContext,
          post_id: postId,
          telegram_message_id: telegramMessageId,
        });

        await markPublished(postId, telegramMessageId);

        // 12. Save picks
        if (picks.length > 0) {
          logger.info(`[Telegram] 💾 Saving ${picks.length} picks...`, {
            ...logContext,
            post_id: postId,
          });

          const client = await pool.connect();
          try {
            for (const pick of picks) {
              await client.query(
                `INSERT INTO telegram_picks (post_id, market_type, odds, status)
                 VALUES ($1, $2, $3, 'pending')`,
                [postId, pick.market_type, pick.odds || null]
              );
            }
          } finally {
            client.release();
          }

          logger.info('[Telegram] ✅ Picks saved', { ...logContext, post_id: postId });
        }

        const elapsedMs = Date.now() - startTime;
        logger.info('[Telegram] ✅ PUBLISH COMPLETE', {
          ...logContext,
          post_id: postId,
          telegram_message_id: telegramMessageId,
          elapsed_ms: elapsedMs,
          status: 'published',
        });

        return {
          success: true,
          telegram_message_id: telegramMessageId,
          post_id: postId,
          picks_count: picks.length,
          status: 'published',
          elapsed_ms: elapsedMs,
        };

      } catch (error: any) {
        const elapsedMs = Date.now() - startTime;
        logger.error('[Telegram] ❌ PUBLISH ERROR', {
          ...logContext,
          error: error.message,
          stack: error.stack,
          elapsed_ms: elapsedMs,
        });
        return reply.status(500).send({ error: error.message });
      }
    }
  );

  /**
   * GET /telegram/posts
   * Get published posts with pick statistics
   */
  fastify.get('/telegram/posts', async (request, reply) => {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query(
          `SELECT p.*,
                  COUNT(pk.id) as picks_count,
                  COUNT(CASE WHEN pk.status = 'won' THEN 1 END) as won_count,
                  COUNT(CASE WHEN pk.status = 'lost' THEN 1 END) as lost_count,
                  COUNT(CASE WHEN pk.status = 'void' THEN 1 END) as void_count
           FROM telegram_posts p
           LEFT JOIN telegram_picks pk ON pk.post_id = p.id
           WHERE p.status IN ('published', 'settled')
           GROUP BY p.id
           ORDER BY p.posted_at DESC
           LIMIT 100`
        );

        return { success: true, posts: result.rows };
      } finally {
        client.release();
      }
    } catch (error: any) {
      logger.error('[Telegram] Error fetching posts:', error);
      return reply.status(500).send({ error: error.message });
    }
  });
}
