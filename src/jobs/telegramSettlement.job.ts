/**
 * Telegram Settlement Job - PHASE-1 HARDENED
 *
 * Schedule: Every 10 minutes
 * Purpose: Settle Telegram published picks for finished matches
 *
 * Process:
 * 1. Find published telegram posts with pending picks
 * 2. Check match status (only process finished matches)
 * 3. Evaluate each pick (BTTS, O25, O15, HT_O05)
 * 4. Reply to Telegram message with results
 * 5. Mark post as settled (status = 'settled')
 *
 * PHASE-1 GUARANTEES:
 * - Max retry limit: Will not retry settlement forever
 * - State machine: Changes status from 'published' to 'settled' or 'failed'
 * - Observable: Structured logging for all operations
 */

import { pool } from '../database/connection';
import { telegramBot } from '../services/telegram/telegram.client';
import { logger } from '../utils/logger';
import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';
import { evaluateSettlement, outcomeToStatus } from '../services/telegram/rules/settlementRules';
import { getMarketLabelTurkish } from '../services/telegram/validators/pickValidator';
import type { SupportedMarketType } from '../services/telegram/validators/pickValidator';

// PHASE-1: Max settlement retry attempts
const MAX_SETTLEMENT_RETRIES = 5;

interface PendingPost {
  id: string;
  match_id: string;
  telegram_message_id: number;
  channel_id: string;
  home_score: number;
  away_score: number;
  ht_home_score: string;
  ht_away_score: string;
  retry_count: number;
  picks: Array<{
    id: string;
    market_type: string;
  }>;
}

export async function runTelegramSettlement(): Promise<void> {
  await jobRunner.run(
    {
      jobName: 'telegramSettlement',
      overlapGuard: true,
      advisoryLockKey: LOCK_KEYS.TELEGRAM_SETTLEMENT,
      timeoutMs: 300000,
    },
    async (_ctx) => {
      logger.info('[TelegramSettlement] Starting...');

      // FIX: Acquire connection ONLY for SELECT, release before processing loop
      let client = await pool.connect();
      let postsToSettle: PendingPost[];
      try {
        // PHASE-1: Get published posts with pending picks for finished matches
        // Skip posts that have exceeded max retry limit
        const result = await client.query<PendingPost>(`
          SELECT
            p.id,
            p.match_id,
            p.telegram_message_id,
            p.channel_id,
            p.retry_count,
            m.home_score_display as home_score,
            m.away_score_display as away_score,
            m.home_scores->0->>'score' as ht_home_score,
            m.away_scores->0->>'score' as ht_away_score,
            (
              SELECT json_agg(json_build_object('id', pk.id, 'market_type', pk.market_type))
              FROM telegram_picks pk
              WHERE pk.post_id = p.id AND pk.status = 'pending'
            ) as picks
          FROM telegram_posts p
          INNER JOIN ts_matches m ON m.external_id = p.match_id
          WHERE p.status = 'published'
            AND m.status_id = 8
            AND p.settled_at IS NULL
            AND p.retry_count < ${MAX_SETTLEMENT_RETRIES}
            AND EXISTS (
              SELECT 1 FROM telegram_picks pk2
              WHERE pk2.post_id = p.id AND pk2.status = 'pending'
            )
        `);

        postsToSettle = result.rows;
      } finally {
        // FIX: Release connection BEFORE processing loop
        client.release();
      }

      let settledCount = 0;

      // FIX: Process each post with fresh connection per operation
      for (const post of postsToSettle) {
          if (!post.picks || post.picks.length === 0) continue;

          // PHASE-2A: Prepare score data for rule engine
          const homeScore = post.home_score || 0;
          const awayScore = post.away_score || 0;
          const htHomeScore = post.ht_home_score ? parseInt(post.ht_home_score) : null;
          const htAwayScore = post.ht_away_score ? parseInt(post.ht_away_score) : null;

          const scoreData = {
            home_score: homeScore,
            away_score: awayScore,
            ht_home_score: htHomeScore,
            ht_away_score: htAwayScore,
          };

          const results: Array<{ pickId: string; won: boolean; status: string; market: string; rule: string }> = [];

          // PHASE-2A: Evaluate each pick using rule engine
          for (const pick of post.picks) {
            logger.info(`[TelegramSettlement] 🎯 Evaluating pick ${pick.id} (${pick.market_type})`);

            // Use rule engine for evaluation
            const settlement = evaluateSettlement(
              pick.market_type as SupportedMarketType,
              scoreData,
              pick.id
            );

            const status = outcomeToStatus(settlement.outcome);
            const won = status === 'won';

            results.push({
              pickId: pick.id,
              won,
              status,
              market: pick.market_type,
              rule: settlement.rule,
            });

            // FIX: Acquire connection for EACH pick update, release immediately
            const pickClient = await pool.connect();
            try {
              await pickClient.query(
                `UPDATE telegram_picks
                 SET status = $1, settled_at = NOW(), result_data = $2
                 WHERE id = $3`,
                [status, JSON.stringify(settlement.data), pick.id]
              );
            } finally {
              pickClient.release();
            }

            logger.info(`[TelegramSettlement] ✅ Pick settled: ${settlement.outcome}`, {
              pick_id: pick.id,
              market_type: pick.market_type,
              outcome: settlement.outcome,
              rule: settlement.rule,
            });
          }

          // Build reply message
          const wonCount = results.filter(r => r.won).length;
          const voidCount = results.filter(r => r.status === 'void').length;
          const totalCount = results.length - voidCount;  // Exclude voids from total
          const emoji = wonCount === totalCount ? '✅' : wonCount > 0 ? '⚠️' : '❌';

          let replyText = `${emoji} <b>Sonuç: ${homeScore}-${awayScore}</b>\n\n`;
          replyText += `📊 Tahmin Durumu: ${wonCount}/${totalCount}\n\n`;

          results.forEach(r => {
            let icon = '❌';
            if (r.status === 'void') icon = '⚪';
            else if (r.won) icon = '✅';

            // PHASE-2A: Use centralized market labels
            const marketLabel = getMarketLabelTurkish(r.market);

            const statusLabel = r.status === 'void' ? ' (VOID)' : '';
            replyText += `${icon} ${marketLabel}${statusLabel}\n`;
          });

          // PHASE-1: Reply to original message with retry tracking
          // FIX: NO connection held during Telegram API call
          try {
            await telegramBot.replyToMessage(
              post.channel_id,
              post.telegram_message_id,
              replyText
            );

            // FIX: Acquire NEW connection for post update
            const postClient = await pool.connect();
            try {
              await postClient.query(
                `UPDATE telegram_posts
                 SET status = 'settled',
                     settled_at = NOW()
                 WHERE id = $1`,
                [post.id]
              );
            } finally {
              postClient.release();
            }

            settledCount++;
            logger.info(`[TelegramSettlement] ✅ Settled post ${post.id}: ${wonCount}/${totalCount} (${voidCount} void)`);
          } catch (err: any) {
            // PHASE-1: Increment retry count on failure
            const newRetryCount = (post.retry_count || 0) + 1;

            // FIX: Acquire NEW connection for error update
            const errorClient = await pool.connect();
            try {
              if (newRetryCount >= MAX_SETTLEMENT_RETRIES) {
                // PHASE-1: Max retries exceeded - mark as FAILED
                await errorClient.query(
                  `UPDATE telegram_posts
                   SET status = 'failed',
                       retry_count = $1,
                       error_log = $2,
                       last_error_at = NOW()
                   WHERE id = $3`,
                  [newRetryCount, `Settlement reply failed: ${err.message}`, post.id]
                );
                logger.error(`[TelegramSettlement] ❌ FAILED after ${newRetryCount} retries for post ${post.id}:`, err);
              } else {
                // PHASE-1: Update retry count and error log
                await errorClient.query(
                  `UPDATE telegram_posts
                   SET retry_count = $1,
                       error_log = $2,
                       last_error_at = NOW()
                   WHERE id = $3`,
                  [newRetryCount, `Settlement reply failed (retry ${newRetryCount}): ${err.message}`, post.id]
                );
                logger.warn(`[TelegramSettlement] ⚠️ Settlement failed (retry ${newRetryCount}/${MAX_SETTLEMENT_RETRIES}) for post ${post.id}:`, err);
              }
            } finally {
              errorClient.release();
            }
          }
        }

        logger.info(`[TelegramSettlement] Settled ${settledCount} posts`);
      }
  );
}
