
import { pool } from '../database/connection';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { logger } from '../utils/logger';

async function fixKickoffs() {
    const service = new MatchDetailLiveService();
    const client = await pool.connect();

    try {
        // 1. Get live matches with status 4 (Second Half) and missing second_half_kickoff_ts
        const matches = await client.query(`
      SELECT external_id, minute, status_id, last_event_ts 
      FROM ts_matches 
      WHERE status_id = 4 
      AND second_half_kickoff_ts IS NULL
    `);

        logger.info(`Found ${matches.rowCount} matches with status 4 and missing second_half_kickoff_ts`);

        for (const match of matches.rows) {
            const matchId = match.external_id;
            logger.info(`Processing match ${matchId}...`);

            try {
                // 2. Fetch live details from API
                const resp = await service.getMatchDetailLive({ match_id: matchId }, { forceRefresh: true });
                const live = service.extractLiveFields(resp, matchId);

                // 3. Check for valid kickoff time
                if (live.liveKickoffTime) {
                    logger.info(`Match ${matchId}: Found liveKickoffTime from API: ${live.liveKickoffTime}`);

                    // 4. Update DB directly
                    await client.query(`
            UPDATE ts_matches
            SET second_half_kickoff_ts = $1, updated_at = NOW()
            WHERE external_id = $2
          `, [live.liveKickoffTime, matchId]);

                    logger.info(`Match ${matchId}: Updated second_half_kickoff_ts to ${live.liveKickoffTime}`);
                } else {
                    logger.warn(`Match ${matchId}: API returned NO liveKickoffTime. Status in API: ${live.statusId}`);
                }
            } catch (err) {
                logger.error(`Error processing match ${matchId}:`, err);
            }
        }

    } catch (error) {
        logger.error('Script error:', error);
    } finally {
        client.release();
        process.exit();
    }
}

fixKickoffs();
