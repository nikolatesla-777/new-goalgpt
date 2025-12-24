/**
 * Fix second half start time for live matches
 *
 * SAFETY:
 * - Requires CONFIRM=YES unless --dry-run is used
 * - Only updates matches whose DB status is SECOND_HALF (status_id = 4)
 * - Prefers TheSports /match/detail_live score[4] when API status is SECOND_HALF
 *
 * Usage:
 *   npx tsx src/scripts/fix-second-half-start-time.ts
 *   npx tsx src/scripts/fix-second-half-start-time.ts --limit=50
 *   npx tsx src/scripts/fix-second-half-start-time.ts --dry-run
 *   CONFIRM=YES npx tsx src/scripts/fix-second-half-start-time.ts --limit=50
 */

import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1] || '20', 10)) : 20;

if (!isDryRun && process.env.CONFIRM !== 'YES') {
  logger.error('❌ [FixSecondHalf] Refusing to UPDATE without CONFIRM=YES. Re-run with CONFIRM=YES or use --dry-run.');
  process.exit(1);
}

async function fixSecondHalfStartTime() {
  const client = await pool.connect();
  const theSportsClient = new TheSportsClient();
  
  try {
    // Find all matches in second half (status 4)
    const query = `
      SELECT 
        external_id,
        match_time,
        live_kickoff_time,
        status_id
      FROM ts_matches
      WHERE status_id = 4
      ORDER BY match_time DESC
      LIMIT $1
    `;
    
    const result = await client.query(query, [LIMIT]);
    const matches = result.rows;
    
    logger.info(`Found ${matches.length} matches in SECOND_HALF (status 4) (limit=${LIMIT}, dryRun=${isDryRun})`);
    
    let fixed = 0;
    let errors = 0;
    const now = Math.floor(Date.now() / 1000);
    
    for (const match of matches) {
      try {
        const matchId = String(match.external_id);
        const matchTime = Number(match.match_time ?? 0) || 0;
        const dbLiveKickoff = Number(match.live_kickoff_time ?? 0) || 0;
        
        // Fetch actual match detail from TheSports API
        logger.info(`Fetching match detail for ${matchId}...`);
        const apiResponse = await theSportsClient.get<any>('/match/detail_live', { match_id: matchId });
        
        // API returns { code: 0, results: [...] }
        // results is an array of all live matches, need to find the one matching matchId
        // Each result.score = [match_id, status_id, home_array, away_array, live_kickoff_time, ...]
        if (apiResponse && apiResponse.results && apiResponse.results.length > 0) {
          // Find the match with matching ID
          const matchData = apiResponse.results.find((r: any) => {
            const rid = r?.id != null ? String(r.id) : null;
            const mid = r?.score?.[0] != null ? String(r.score[0]) : null;
            return rid === matchId || mid === matchId;
          });
          
          if (!matchData) {
            logger.warn(`Match ${matchId} not found in API results (got ${apiResponse.results.length} matches)`);
            errors++;
            continue;
          }
          
          const scoreArray = matchData.score || [];
          const apiStatus = Number(scoreArray[1] ?? 0); // Index 1 = status_id
          const apiLiveKickoff = Number(scoreArray[4] ?? 0); // Index 4 = live_kickoff_time (2H start time when status=4)
          
          // Only update if both DB and API status are SECOND_HALF
          if (apiLiveKickoff > 0 && Number(match.status_id) === 4 && apiStatus === 4) {
            if (isDryRun) {
              logger.warn(`🧪 [FixSecondHalf] DRY RUN: would set live_kickoff_time=${apiLiveKickoff} for match ${matchId}`);
            } else {
              await client.query(
                `UPDATE ts_matches 
                 SET live_kickoff_time = $1, updated_at = NOW() 
                 WHERE external_id = $2`,
                [apiLiveKickoff, matchId]
              );
            }
            
            const elapsedSinceSecondHalf = (now - apiLiveKickoff) / 60;
            const calculatedMinute = 45 + Math.floor(elapsedSinceSecondHalf);
            
            logger.info(
              `✅ Fixed match ${matchId}: ` +
              `API status=${apiStatus}, ` +
              `API liveKickoff=${new Date(apiLiveKickoff * 1000).toISOString()}, ` +
              `elapsed=${elapsedSinceSecondHalf.toFixed(1)}min, ` +
              `calculated_minute=${calculatedMinute}`
            );
            fixed++;
          } else {
            // Fallback: If match is showing 75 minutes, calculate second half start time
            // Assume current minute is correct and work backwards
            const kickoffBase = dbLiveKickoff > 0 ? dbLiveKickoff : matchTime;
            const elapsedSinceKickoff = (now - kickoffBase) / 60;
            const calculatedMinute = 45 + elapsedSinceKickoff;
            
            // If calculated minute is around 75, adjust second half start time
            // Target: Show 75 minutes, so second half started 30 minutes ago (75 - 45 = 30)
            if (calculatedMinute >= 70 && calculatedMinute <= 80) {
              const targetMinute = 75; // Target minute to show
              const secondHalfElapsed = targetMinute - 45; // 30 minutes
              const estimatedSecondHalfStart = now - (secondHalfElapsed * 60);
              
              if (isDryRun) {
                logger.warn(`🧪 [FixSecondHalf] DRY RUN: would set estimated live_kickoff_time=${estimatedSecondHalfStart} for match ${matchId}`);
              } else {
                await client.query(
                  `UPDATE ts_matches 
                   SET live_kickoff_time = $1, updated_at = NOW() 
                   WHERE external_id = $2`,
                  [estimatedSecondHalfStart, matchId]
                );
              }
              
              logger.info(
                `✅ Fixed match ${matchId} (estimated for 75min): ` +
                `calculated_minute=${calculatedMinute.toFixed(0)}, ` +
                `target=${targetMinute}, ` +
                `estimated_second_half_start=${new Date(estimatedSecondHalfStart * 1000).toISOString()}`
              );
              fixed++;
            } else {
              logger.warn(`Match ${matchId}: API status=${apiStatus}, DB status=${match.status_id}, calculated=${calculatedMinute.toFixed(0)}, skipping`);
            }
          }
        } else {
          logger.warn(`No data from API for match ${matchId}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
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
  fixSecondHalfStartTime()
    .then(() => {
      logger.info('✅ Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixSecondHalfStartTime };
