/**
 * Backfill second_half_kickoff_ts for current live second-half matches
 *
 * PROBLEM:
 * - 18 out of 26 second-half matches have NULL second_half_kickoff_ts
 * - MatchMinuteWorker cannot calculate accurate minutes without kickoff timestamps
 * - Matches appear stuck at 105' (90+15) or other incorrect values
 *
 * SOLUTION:
 * - Estimate second_half_kickoff_ts for live matches
 * - Use first_half_kickoff_ts + 2700s (45 min) if available
 * - Fallback to match_time + 2700s if first_half_kickoff_ts missing
 * - Only update matches currently in status 4 (second half)
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function backfillSecondHalfKickoff() {
  const client = await pool.connect();
  try {
    logger.info('[BackfillKickoff] Starting second_half_kickoff_ts backfill for live matches...');

    // Get second-half matches without kickoff timestamp
    const query = `
      SELECT
        external_id,
        status_id,
        first_half_kickoff_ts,
        match_time,
        minute
      FROM ts_matches
      WHERE status_id = 4
        AND second_half_kickoff_ts IS NULL
      ORDER BY match_time DESC
    `;

    const result = await client.query(query);
    const matches = result.rows;

    if (matches.length === 0) {
      logger.info('[BackfillKickoff] No matches need backfilling');
      return;
    }

    logger.info(`[BackfillKickoff] Found ${matches.length} second-half matches missing kickoff timestamp`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const match of matches) {
      const matchId = match.external_id;
      const firstHalfKickoffTs = match.first_half_kickoff_ts ? Number(match.first_half_kickoff_ts) : null;
      const matchTime = match.match_time ? Number(match.match_time) : null;
      const currentMinute = match.minute;

      // ESTIMATION LOGIC:
      // Best case: first_half_kickoff_ts + 2700s (45 min)
      // Fallback: match_time + 2700s
      let estimatedSecondHalfKickoff: number | null = null;

      if (firstHalfKickoffTs) {
        // BEST: Use first half kickoff + 45 minutes
        estimatedSecondHalfKickoff = firstHalfKickoffTs + 2700;
        logger.info(`[BackfillKickoff] ${matchId}: Using first_half + 45min = ${estimatedSecondHalfKickoff} (minute: ${currentMinute})`);
      } else if (matchTime) {
        // FALLBACK: Use match_time + 45 minutes
        estimatedSecondHalfKickoff = matchTime + 2700;
        logger.warn(`[BackfillKickoff] ${matchId}: Using match_time + 45min = ${estimatedSecondHalfKickoff} (minute: ${currentMinute}) [LESS ACCURATE]`);
      } else {
        logger.error(`[BackfillKickoff] ${matchId}: Cannot estimate - no kickoff data available (minute: ${currentMinute})`);
        skippedCount++;
        continue;
      }

      // Update database
      const updateQuery = `
        UPDATE ts_matches
        SET second_half_kickoff_ts = $1
        WHERE external_id = $2
          AND status_id = 4
          AND second_half_kickoff_ts IS NULL
      `;

      const updateResult = await client.query(updateQuery, [estimatedSecondHalfKickoff, matchId]);

      if (updateResult.rowCount && updateResult.rowCount > 0) {
        updatedCount++;
        logger.info(`[BackfillKickoff] ✅ Updated ${matchId}: second_half_kickoff_ts = ${estimatedSecondHalfKickoff}`);
      } else {
        skippedCount++;
        logger.warn(`[BackfillKickoff] ⚠️ No rows updated for ${matchId}`);
      }
    }

    logger.info(`[BackfillKickoff] ✅ COMPLETE: Updated ${updatedCount} matches, skipped ${skippedCount}`);
    logger.info('[BackfillKickoff] ℹ️ MatchMinuteWorker will now calculate accurate minutes on next tick (30s)');

  } catch (error) {
    logger.error('[BackfillKickoff] Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
backfillSecondHalfKickoff()
  .then(() => {
    logger.info('[BackfillKickoff] Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('[BackfillKickoff] Script failed:', error);
    process.exit(1);
  });
