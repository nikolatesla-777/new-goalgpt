/**
 * Fix live_kickoff_time for all LIVE matches (status 4 = SECOND_HALF)
 * 
 * CRITICAL: When status is 4, live_kickoff_time should be the SECOND HALF START TIME
 * Formula: CurrentMinute = 45 + (CurrentTime - SecondHalfStartTime) / 60
 * 
 * This script:
 * 1. Finds all matches with status 4 (SECOND_HALF)
 * 2. Fetches actual elapsed time from TheSports API (/match/detail_live)
 * 3. Calculates correct second_half_start_time
 * 4. Updates live_kickoff_time in database
 */

import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function fixLiveKickoffTime() {
  const client = await pool.connect();
  const theSportsClient = new TheSportsClient();
  
  try {
    // Find all matches with status 4 (SECOND_HALF)
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
      ORDER BY match_time DESC
      LIMIT 50
    `;
    
    const result = await client.query(query);
    const matches = result.rows;
    
    logger.info(`Found ${matches.length} matches in SECOND_HALF (status 4)`);
    
    let fixed = 0;
    let errors = 0;
    
    for (const match of matches) {
      try {
        const matchId = match.external_id;
        const now = Math.floor(Date.now() / 1000);
        const matchTime = parseInt(match.match_time) || 0;
        
        if (!matchTime || matchTime <= 0) {
          logger.warn(`Match ${matchId} has invalid match_time, skipping`);
          errors++;
          continue;
        }
        
        // Fetch actual match detail from TheSports API
        logger.info(`Fetching match detail for ${matchId}...`);
        const apiResponse = await theSportsClient.get<any>('/match/detail_live', { match_id: matchId });
        
        // Fallback: Calculate from match_time if API fails
        // Calculate second half start time: match_time + 60 minutes (45 min first + 15 min halftime)
        const estimatedSecondHalfStart = matchTime + (60 * 60);

        // TheSports responses sometimes use `result` or `results`
        const matchDetail = apiResponse?.result ?? apiResponse?.results ?? null;

        if (!matchDetail) {
          logger.warn(`No data from API for match ${matchId}, using fallback calculation`);
          
          // Always update if match is in second half (status 4)
          await client.query(
            `UPDATE ts_matches 
             SET live_kickoff_time = $1, updated_at = NOW() 
             WHERE external_id = $2`,
            [estimatedSecondHalfStart, matchId]
          );
          
          const elapsedSinceSecondHalf = (now - estimatedSecondHalfStart) / 60;
          const calculatedMinute = 45 + Math.floor(elapsedSinceSecondHalf);
          
          logger.info(
            `✅ Fixed match ${matchId} (fallback): ` +
            `match_time=${new Date(matchTime * 1000).toISOString()}, ` +
            `second_half_start=${new Date(estimatedSecondHalfStart * 1000).toISOString()}, ` +
            `elapsed=${elapsedSinceSecondHalf.toFixed(1)}min, ` +
            `calculated_minute=${calculatedMinute}`
          );
          fixed++;
          continue;
        }
        
        const apiStatus = matchDetail.status || matchDetail.status_id || match.status_id;
        const apiElapsed = matchDetail.elapsed || matchDetail.elapsed_time || matchDetail.current_minute || null;
        
        // If API provides elapsed time, use it
        if (apiElapsed !== null && apiElapsed > 0) {
          // For second half: elapsed is total minutes, we need second half elapsed
          // If elapsed > 45, it's in second half
          if (apiElapsed > 45 && apiStatus === 4) {
            const secondHalfElapsed = apiElapsed - 45; // Minutes into second half
            const secondHalfStartTime = now - (secondHalfElapsed * 60); // Calculate second half start time
            
            // Update live_kickoff_time
            await client.query(
              `UPDATE ts_matches 
               SET live_kickoff_time = $1, updated_at = NOW() 
               WHERE external_id = $2`,
              [secondHalfStartTime, matchId]
            );
            
            logger.info(
              `✅ Fixed match ${matchId}: ` +
              `elapsed=${apiElapsed}min, ` +
              `second_half_elapsed=${secondHalfElapsed}min, ` +
              `second_half_start=${new Date(secondHalfStartTime * 1000).toISOString()}`
            );
            fixed++;
          } else {
            logger.warn(`Match ${matchId}: elapsed=${apiElapsed}, status=${apiStatus} - skipping`);
          }
        } else {
          // Fallback: Calculate from match_time
          // Assume second half started 60 minutes after match_time (45 min first + 15 min halftime)
          const estimatedSecondHalfStart = matchTime + (60 * 60); // 60 minutes after match_time
          
          // If estimated start is in the past, use it
          if (estimatedSecondHalfStart < now) {
            await client.query(
              `UPDATE ts_matches 
               SET live_kickoff_time = $1, updated_at = NOW() 
               WHERE external_id = $2`,
              [estimatedSecondHalfStart, matchId]
            );
            
            const elapsedSinceSecondHalf = (now - estimatedSecondHalfStart) / 60;
            const calculatedMinute = 45 + Math.floor(elapsedSinceSecondHalf);
            
            logger.info(
              `✅ Fixed match ${matchId} (estimated): ` +
              `second_half_start=${new Date(estimatedSecondHalfStart * 1000).toISOString()}, ` +
              `calculated_minute=${calculatedMinute}`
            );
            fixed++;
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error: any) {
        logger.error(`Error fixing match ${match.external_id}:`, error.message);
        errors++;
      }
    }
    
    logger.info(`✅ Fixed ${fixed} matches, ${errors} errors`);
    
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  fixLiveKickoffTime()
    .then(() => {
      logger.info('✅ Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixLiveKickoffTime };
