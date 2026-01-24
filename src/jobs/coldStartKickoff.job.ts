import { pool } from '../database/connection';
import { logger } from '../utils/logger';

/**
 * Cold Start Kickoff Backfill - SMART VERSION
 *
 * Called once on server startup to backfill missing kickoff timestamps
 * for matches that are already live when the server restarts.
 *
 * SMART LOGIC:
 * - If match has a valid minute (1-120), calculate kickoff as: NOW - (minute * 60)
 * - This gives accurate kickoff timestamp even for matches deep into game
 * - If minute is NULL/invalid, use conservative estimate: match_time + 180
 */
export async function coldStartKickoffBackfill(): Promise<void> {
  console.log('=====================');
  console.log('[ColdStart] SMART BACKFILL - Starting');
  console.log('[ColdStart] Timestamp:', new Date().toISOString());
  console.log('=====================');

  try {
    logger.info('[ColdStart] Starting smart kickoff timestamp backfill...');

    const nowTs = Math.floor(Date.now() / 1000);
    console.log('[ColdStart] nowTs:', nowTs);

    // SMART FIRST HALF BACKFILL
    // If minute is valid (1-50), calculate: NOW - (minute * 60)
    // Otherwise use fallback: match_time + 180
    const result1 = await pool.query(`
      UPDATE ts_matches
      SET first_half_kickoff_ts = CASE
        WHEN minute IS NOT NULL AND minute >= 1 AND minute <= 50
          THEN $1 - (minute * 60)
        ELSE match_time + 180
      END
      WHERE status_id IN (2, 3, 4, 5, 7)
        AND first_half_kickoff_ts IS NULL
        AND match_time < $1
      RETURNING external_id, minute, first_half_kickoff_ts,
        CASE
          WHEN minute IS NOT NULL AND minute >= 1 AND minute <= 50 THEN 'smart'
          ELSE 'fallback'
        END as method
    `, [nowTs]);

    console.log('[ColdStart] First half query result:', result1.rowCount, 'rows');
    if (result1.rowCount! > 0) {
      const smart = result1.rows.filter(r => r.method === 'smart').length;
      const fallback = result1.rows.filter(r => r.method === 'fallback').length;
      logger.info(`[ColdStart] ✅ Backfilled first_half_kickoff_ts for ${result1.rowCount} matches (smart: ${smart}, fallback: ${fallback})`);
      result1.rows.forEach(row => {
        console.log(`  - ${row.external_id}: minute=${row.minute}, method=${row.method}`);
      });
    }

    // SMART SECOND HALF BACKFILL
    // If minute is valid (46-120), calculate: NOW - ((minute - 45) * 60)
    // Otherwise use fallback: first_half_kickoff + 2700
    const result2 = await pool.query(`
      UPDATE ts_matches
      SET second_half_kickoff_ts = CASE
        WHEN minute IS NOT NULL AND minute >= 46 AND minute <= 120
          THEN $1 - ((minute - 45) * 60)
        ELSE COALESCE(first_half_kickoff_ts, match_time) + 2700
      END
      WHERE status_id IN (4, 5, 7)
        AND second_half_kickoff_ts IS NULL
        AND match_time < $1
      RETURNING external_id, minute, second_half_kickoff_ts,
        CASE
          WHEN minute IS NOT NULL AND minute >= 46 AND minute <= 120 THEN 'smart'
          ELSE 'fallback'
        END as method
    `, [nowTs]);

    console.log('[ColdStart] Second half query result:', result2.rowCount, 'rows');
    if (result2.rowCount! > 0) {
      const smart = result2.rows.filter(r => r.method === 'smart').length;
      const fallback = result2.rows.filter(r => r.method === 'fallback').length;
      logger.info(`[ColdStart] ✅ Backfilled second_half_kickoff_ts for ${result2.rowCount} matches (smart: ${smart}, fallback: ${fallback})`);
      result2.rows.forEach(row => {
        console.log(`  - ${row.external_id}: minute=${row.minute}, method=${row.method}`);
      });
    }

    if (result1.rowCount === 0 && result2.rowCount === 0) {
      console.log('[ColdStart] No missing kickoff timestamps found. All good!');
      logger.info('[ColdStart] No missing kickoff timestamps found. All good!');
    }

    console.log('[ColdStart] Smart kickoff backfill complete');
    logger.info('[ColdStart] Smart kickoff backfill complete');
  } catch (error) {
    console.error('[ColdStart] ERROR:', error);
    logger.error('[ColdStart] Failed to backfill kickoff timestamps:', error);
    // Don't throw - allow server to start even if backfill fails
  }
}
