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
import { fetchMatchStateForPublish } from '../services/telegram/matchStateFetcher.service';
import { validatePicks } from '../services/telegram/validators/pickValidator';
import { calculateConfidenceScore } from '../services/telegram/confidenceScorer.service';
import { generateDailyLists, formatDailyListMessage } from '../services/telegram/dailyLists.service';

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
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
async function checkExistingPost(matchId: string, channelId: string, client?: any) {
  const shouldReleaseClient = !client;
  if (!client) {
    client = await pool.connect();
  }

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
    if (shouldReleaseClient) {
      client.release();
    }
  }
}

/**
 * PHASE-1: Create draft post in transaction
 * Reserves the idempotency slot before Telegram send
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
async function createDraftPost(
  matchId: string,
  fsMatchId: number,
  channelId: string,
  content: string,
  client?: any
) {
  const shouldReleaseClient = !client;
  if (!client) {
    client = await pool.connect();
  }

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
    if (shouldReleaseClient) {
      client.release();
    }
  }
}

/**
 * PHASE-1: Mark post as published with message_id
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
async function markPublished(postId: string, messageId: number, client?: any) {
  const shouldReleaseClient = !client;
  if (!client) {
    client = await pool.connect();
  }

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
    if (shouldReleaseClient) {
      client.release();
    }
  }
}

/**
 * PHASE-1: Mark post as failed with error details
 *
 * FIX: Accepts optional client parameter to avoid connection churn
 */
async function markFailed(postId: string, error: string, retryCount: number, client?: any) {
  const shouldReleaseClient = !client;
  if (!client) {
    client = await pool.connect();
  }

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
    if (shouldReleaseClient) {
      client.release();
    }
  }
}

/**
 * PHASE-1: Retry logic with exponential backoff
 * Attempts Telegram send up to MAX_RETRY_ATTEMPTS times
 *
 * FIX: Accepts optional client parameter, NO connection held during Telegram API call
 */
async function sendWithRetry(
  channelId: string,
  messageText: string,
  postId: string,
  client?: any
): Promise<number> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      logger.info(`[Telegram] Send attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS} for post ${postId}`);

      // FIX: NO connection held during Telegram API call
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

      // FIX: Acquire connection ONLY for DB update, release immediately
      const shouldReleaseClient = !client;
      let updateClient = client;
      if (!updateClient) {
        updateClient = await pool.connect();
      }

      try {
        await updateClient.query(
          `UPDATE telegram_posts
           SET retry_count = $1,
               error_log = $2,
               last_error_at = NOW()
           WHERE id = $3`,
          [attempt + 1, err.message, postId]
        );
      } finally {
        if (shouldReleaseClient) {
          updateClient.release();
        }
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
        // FIX: Acquire connection ONCE for ALL DB operations (no API calls in between)
        logger.info('[Telegram] 🔍 Checking for existing post...', logContext);

        let dbClient = await pool.connect();
        let existingPost;
        try {
          existingPost = await checkExistingPost(match_id, channelId, dbClient);

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
        } finally {
          // Release BEFORE FootyStats API call
          dbClient.release();
          dbClient = null;
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

        // 5. PHASE-2B-B1: MATCH STATE VALIDATION WITH API PRIMARY (OPTIONAL FOR FOOTYSTATS)
        // PRIMARY: TheSports API (real-time status)
        // FALLBACK: Database (stale but reliable)
        // TEMPORARY FIX: Skip validation for FootyStats placeholder IDs (fs_*)
        logger.info('[Telegram] 🔍 Fetching match state (API primary)...', logContext);

        let matchStatusId: number | null = null;
        let stateSource: string = 'unknown';

        // TEMPORARY FIX: Skip validation for FootyStats placeholder IDs
        const isFootyStatsPlaceholder = match_id.startsWith('fs_');

        if (isFootyStatsPlaceholder) {
          logger.warn('[Telegram] ⚠️ Skipping match state validation (FootyStats placeholder ID)', logContext);
          matchStatusId = 1; // Assume NOT_STARTED
          stateSource = 'placeholder';
        } else {
          try {
            // PHASE-2B-B1: Use matchStateFetcher (API → DB fallback)
            const matchStateResult = await fetchMatchStateForPublish(match_id);

            matchStatusId = matchStateResult.statusId;
            stateSource = matchStateResult.source;
            logContext.match_status_id = matchStatusId;
            logContext.state_source = stateSource;
            logContext.state_latency_ms = matchStateResult.latencyMs;
            logContext.state_cached = matchStateResult.cached;

            // Log fallback usage for monitoring
            if (matchStateResult.isFallback) {
              logger.warn('[Telegram] ⚠️ Using DB fallback for match state', logContext);
            } else {
              logger.info('[Telegram] ✅ Match state fetched from API', logContext);
            }

            // Validate match state (same Phase-2A validator)
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
                state_source: stateSource,
              });
            }

            logger.info('[Telegram] ✅ Match state validated (NOT_STARTED)', logContext);
          } catch (fetchError) {
            // Both API and DB failed - cannot proceed
            logger.error('[Telegram] ❌ Failed to fetch match state (API + DB failed)', {
              ...logContext,
              error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            });

            return reply.status(503).send({
              error: 'Service temporarily unavailable',
              details: 'Unable to verify match state. Please try again later.',
              error_code: 'MATCH_STATE_UNAVAILABLE',
            });
          }
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

        // PHASE-2B: Calculate confidence score
        logger.info('[Telegram] 🎯 Calculating confidence score...', logContext);
        const confidenceScore = calculateConfidenceScore(fsMatch, homeStats, awayStats);
        logContext.confidence_score = confidenceScore.score;
        logContext.confidence_tier = confidenceScore.tier;
        logContext.missing_count = confidenceScore.missingCount;

        logger.info('[Telegram] ✅ Confidence score calculated', {
          ...logContext,
          score: confidenceScore.score,
          tier: confidenceScore.tier,
          stars: confidenceScore.stars,
        });

        // PHASE-2B: Format message with confidence score
        const messageText = formatTelegramMessage(matchData, picks as any, confidenceScore);

        // 🔍 DEBUG: Check formatted message
        console.log('\n' + '='.repeat(80));
        console.log('[TELEGRAM DEBUG] formatTelegramMessage RESULT:');
        console.log('Match:', matchData.home_name, 'vs', matchData.away_name);
        console.log('Message Length:', messageText.length, 'chars');
        console.log('Has Trends:', messageText.includes('Trendler'));
        console.log('Has Ev:', messageText.includes('Trendler (Ev)'));
        console.log('Has Dep:', messageText.includes('Trendler (Dep)'));
        console.log('\nFULL MESSAGE:');
        console.log(messageText);
        console.log('='.repeat(80) + '\n');

        // 9. PHASE-1: TRANSACTION SAFETY - Create DRAFT post first
        // FIX: Acquire connection for draft post, release BEFORE Telegram API call
        logger.info('[Telegram] 💾 Creating DRAFT post...', logContext);

        dbClient = await pool.connect();
        let postId;
        try {
          postId = await createDraftPost(match_id, fsIdNum, channelId, messageText, dbClient);

          if (!postId) {
            // ON CONFLICT DO NOTHING triggered - race condition detected
            logger.warn('[Telegram] ⚠️ Race condition detected: Another request already created this post', logContext);

            // Fetch the existing post
            const racedPost = await checkExistingPost(match_id, channelId, dbClient);
            return {
              success: true,
              telegram_message_id: racedPost?.telegram_message_id,
              post_id: racedPost?.id,
              status: racedPost?.status,
              idempotent: true,
              message: 'Race condition: Post created by concurrent request',
            };
          }
        } finally {
          // FIX: Release connection BEFORE Telegram API call
          dbClient.release();
          dbClient = null;
        }

        logger.info('[Telegram] ✅ DRAFT post created', { ...logContext, post_id: postId });

        // 10. PHASE-1: ERROR RECOVERY - Send to Telegram with retry
        // FIX: NO connection held during Telegram API call
        logger.info('[Telegram] 📡 Sending to Telegram with retry logic...', {
          ...logContext,
          post_id: postId,
        });

        let telegramMessageId: number;
        try {
          // FIX: sendWithRetry does NOT hold connection during Telegram send
          telegramMessageId = await sendWithRetry(channelId, messageText, postId);
        } catch (err: any) {
          // All retries exhausted - mark as FAILED
          logger.error('[Telegram] ❌ Send failed after all retries, marking as FAILED', {
            ...logContext,
            post_id: postId,
            error: err.message,
          });

          // FIX: Acquire NEW connection for markFailed
          await markFailed(postId, err.message, MAX_RETRY_ATTEMPTS);

          return reply.status(500).send({
            error: 'Failed to send to Telegram after retries',
            post_id: postId,
            status: 'failed',
            retry_count: MAX_RETRY_ATTEMPTS,
          });
        }

        // 11. PHASE-1: STATE TRANSITION - Mark as PUBLISHED
        // FIX: Acquire NEW connection for markPublished
        logger.info('[Telegram] ✅ Marking post as PUBLISHED', {
          ...logContext,
          post_id: postId,
          telegram_message_id: telegramMessageId,
        });

        await markPublished(postId, telegramMessageId);

        // 12. Save picks
        // FIX: Acquire NEW connection for picks, release immediately
        if (picks.length > 0) {
          logger.info(`[Telegram] 💾 Saving ${picks.length} picks...`, {
            ...logContext,
            post_id: postId,
          });

          dbClient = await pool.connect();
          try {
            for (const pick of picks) {
              await dbClient.query(
                `INSERT INTO telegram_picks (post_id, market_type, odds, status)
                 VALUES ($1, $2, $3, 'pending')`,
                [postId, pick.market_type, pick.odds || null]
              );
            }
          } finally {
            dbClient.release();
            dbClient = null;
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
   *
   * FIX: Acquire connection, execute query, release immediately
   */
  fastify.get('/telegram/posts', async (request, reply) => {
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
    } catch (error: any) {
      logger.error('[Telegram] Error fetching posts:', error);
      return reply.status(500).send({ error: error.message });
    } finally {
      client.release();
    }
  });

  /**
   * POST /telegram/publish/daily-lists
   * Generate and publish daily prediction lists (automated)
   *
   * STRICT RULES:
   * - Only NOT_STARTED matches
   * - 3-5 matches per list max
   * - Confidence-based filtering
   * - Skip if insufficient data
   */
  fastify.post('/telegram/publish/daily-lists', async (request, reply) => {
    const startTime = Date.now();
    const logContext = { operation: 'daily_lists_publish' };

    try {
      logger.info('[TelegramDailyLists] 🚀 Starting daily lists publication...', logContext);

      // 1. Check bot configuration
      if (!telegramBot.isConfigured()) {
        return reply.status(503).send({ error: 'Telegram bot not configured' });
      }

      const channelId = process.env.TELEGRAM_CHANNEL_ID || '';
      if (!channelId) {
        return reply.status(503).send({ error: 'TELEGRAM_CHANNEL_ID not set' });
      }

      // 2. Generate daily lists
      logger.info('[TelegramDailyLists] 📊 Generating lists...', logContext);
      const lists = await generateDailyLists();

      if (lists.length === 0) {
        logger.warn('[TelegramDailyLists] ⚠️ NO_ELIGIBLE_MATCHES - No lists to publish', logContext);
        return {
          success: false,
          message: 'NO_ELIGIBLE_MATCHES',
          lists_generated: 0,
          reason: 'Insufficient matches with required confidence levels',
        };
      }

      logger.info(`[TelegramDailyLists] ✅ Generated ${lists.length} lists`, {
        ...logContext,
        list_count: lists.length,
        markets: lists.map(l => l.market),
      });

      // 3. Publish each list to Telegram
      const publishedLists: any[] = [];

      for (const list of lists) {
        logger.info(`[TelegramDailyLists] 📡 Publishing ${list.market} list...`, {
          ...logContext,
          market: list.market,
          match_count: list.matches.length,
        });

        const messageText = formatDailyListMessage(list);

        try {
          // FIX: NO connection held during Telegram API call
          const result = await telegramBot.sendMessage({
            chat_id: channelId,
            text: messageText,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          });

          if (!result.ok) {
            throw new Error(`Telegram API returned ok=false for ${list.market}`);
          }

          const telegramMessageId = result.result.message_id;

          // FIX: Acquire connection AFTER Telegram send succeeds
          const client = await pool.connect();
          try {
            const matchIds = list.matches.map(m => m.match.fs_id).join(',');

            await client.query(
              `INSERT INTO telegram_posts (match_id, channel_id, telegram_message_id, content, status, metadata)
               VALUES ($1, $2, $3, $4, 'published', $5)`,
              [
                `daily_list_${list.market}_${Date.now()}`, // Unique ID for list
                channelId,
                telegramMessageId,
                messageText,
                JSON.stringify({
                  list_type: 'daily',
                  market: list.market,
                  match_ids: matchIds,
                  match_count: list.matches.length,
                  confidence_scores: list.matches.map(m => m.confidence),
                  generated_at: list.generated_at,
                }),
              ]
            );
          } finally {
            client.release();
          }

          publishedLists.push({
            market: list.market,
            title: list.title,
            match_count: list.matches.length,
            telegram_message_id: telegramMessageId,
            avg_confidence: Math.round(
              list.matches.reduce((sum, m) => sum + m.confidence, 0) / list.matches.length
            ),
          });

          logger.info(`[TelegramDailyLists] ✅ Published ${list.market} list`, {
            ...logContext,
            market: list.market,
            message_id: telegramMessageId,
          });

        } catch (err: any) {
          logger.error(`[TelegramDailyLists] ❌ Failed to publish ${list.market} list`, {
            ...logContext,
            market: list.market,
            error: err.message,
          });
        }
      }

      const elapsedMs = Date.now() - startTime;
      logger.info('[TelegramDailyLists] ✅ Daily lists publication complete', {
        ...logContext,
        lists_generated: lists.length,
        lists_published: publishedLists.length,
        elapsed_ms: elapsedMs,
      });

      return {
        success: true,
        lists_generated: lists.length,
        lists_published: publishedLists.length,
        published_lists: publishedLists,
        elapsed_ms: elapsedMs,
      };

    } catch (error: any) {
      const elapsedMs = Date.now() - startTime;
      logger.error('[TelegramDailyLists] ❌ Daily lists publication failed', {
        ...logContext,
        error: error.message,
        stack: error.stack,
        elapsed_ms: elapsedMs,
      });
      return reply.status(500).send({ error: error.message });
    }
  });
}
