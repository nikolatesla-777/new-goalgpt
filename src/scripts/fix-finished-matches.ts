/**
 * Fix finished matches - Set status to FT (8) if they should be finished
 * 
 * CRITICAL: Check matches that are showing 90+ minutes and update their status
 */

import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function fixFinishedMatches() {
  const client = await pool.connect();
  const theSportsClient = new TheSportsClient();

  try {
    // Find matches in second half (status 4) that might be finished
    // Check matches starting at 18:30 and 19:00
    const now = Math.floor(Date.now() / 1000);
    const query = `
      SELECT 
        external_id,
        match_time,
        live_kickoff_time,
        status_id,
        home_score_regular,
        away_score_regular
      FROM ts_matches
      WHERE status_id = 4
        AND match_time >= $1
        AND match_time < $2
      ORDER BY match_time DESC
    `;

    // 18:30 matches: 1766156400 to 1766158200
    // 19:00 matches: 1766158200 to 1766160000
    const start18_30 = 1766156400;
    const end19_00 = 1766160000;

    const result = await client.query(query, [start18_30, end19_00]);
    const matches = result.rows;

    logger.info(`Found ${matches.length} matches in SECOND_HALF (status 4) for 18:30-19:00`);

    let updated = 0;
    let errors = 0;

    for (const match of matches) {
      try {
        const matchId = match.external_id;
        const matchTime = parseInt(match.match_time) || 0;
        const liveKickoff = parseInt(match.live_kickoff_time) || matchTime;

        // Calculate elapsed time since second half started
        const elapsedSinceSecondHalf = (now - liveKickoff) / 60;
        const calculatedMinute = 45 + Math.floor(elapsedSinceSecondHalf);

        // If calculated minute is > 90, check API for actual status
        if (calculatedMinute > 90) {
          logger.info(`Match ${matchId} shows ${calculatedMinute} minutes, checking API...`);

          try {
            const apiResponse = await theSportsClient.get('/match/detail_live', { match_id: matchId });

            if (apiResponse && (apiResponse as any).result) {
              const apiStatus = (apiResponse as any).result.status || (apiResponse as any).result.status_id;

              // Status 8 = END, Status 10 = FINISHED
              if (apiStatus === 8 || apiStatus === 10 || apiStatus === 12) {
                // Update status to END (8)
                await client.query(
                  `UPDATE ts_matches 
                   SET status_id = 8, updated_at = NOW() 
                   WHERE external_id = $1`,
                  [matchId]
                );

                logger.info(
                  `✅ Updated match ${matchId} to END (status 8): ` +
                  `API status=${apiStatus}, calculated_minute=${calculatedMinute}`
                );
                updated++;
              } else {
                logger.info(`Match ${matchId} still LIVE: API status=${apiStatus}, calculated_minute=${calculatedMinute}`);
              }
            } else {
              // If API doesn't respond and minute > 95, assume finished
              if (calculatedMinute > 95) {
                await client.query(
                  `UPDATE ts_matches 
                   SET status_id = 8, updated_at = NOW() 
                   WHERE external_id = $1`,
                  [matchId]
                );

                logger.info(
                  `✅ Updated match ${matchId} to END (status 8) - assumed finished: ` +
                  `calculated_minute=${calculatedMinute}`
                );
                updated++;
              }
            }
          } catch (apiError: any) {
            logger.warn(`API error for match ${matchId}: ${apiError.message}`);
            // If minute > 95 and API fails, assume finished
            if (calculatedMinute > 95) {
              await client.query(
                `UPDATE ts_matches 
                 SET status_id = 8, updated_at = NOW() 
                 WHERE external_id = $1`,
                [matchId]
              );

              logger.info(
                `✅ Updated match ${matchId} to END (status 8) - API failed, assumed finished: ` +
                `calculated_minute=${calculatedMinute}`
              );
              updated++;
            }
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        logger.error(`Error processing match ${match.external_id}:`, error.message);
        errors++;
      }
    }

    logger.info(`✅ Updated ${updated} matches to END (status 8), ${errors} errors`);

    // Show results
    const resultQuery = `
      SELECT 
        external_id,
        status_id,
        match_time,
        live_kickoff_time,
        home_score_regular,
        away_score_regular
      FROM ts_matches
      WHERE match_time >= $1 AND match_time < $2
      ORDER BY match_time ASC
    `;

    const results = await client.query(resultQuery, [start18_30, end19_00]);
    logger.info(`\n=== RESULTS ===`);
    for (const row of results.rows) {
      const mt = parseInt(row.match_time);
      const lkt = parseInt(row.live_kickoff_time) || mt;
      const elapsed = (now - lkt) / 60;
      const minute = row.status_id === 4 ? 45 + Math.floor(elapsed) : 0;
      logger.info(
        `Match ${row.external_id}: status=${row.status_id}, ` +
        `match_time=${new Date(mt * 1000).toISOString()}, ` +
        `live_kickoff=${new Date(lkt * 1000).toISOString()}, ` +
        `minute=${minute}, score=${row.home_score_regular}-${row.away_score_regular}`
      );
    }

  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  fixFinishedMatches()
    .then(() => {
      logger.info('✅ Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixFinishedMatches };

