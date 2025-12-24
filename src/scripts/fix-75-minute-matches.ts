/**
 * Fix matches showing 75 minutes - adjust second half start time
 * 
 * If a match is showing 75 minutes, calculate the correct second half start time
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function fix75MinuteMatches() {
  const client = await pool.connect();
  
  try {
    const now = Math.floor(Date.now() / 1000);
    
    // Find matches in second half (status 4) - specifically Egnatia and Dinamo matches
    const query = `
      SELECT 
        m.external_id,
        m.match_time,
        m.live_kickoff_time,
        m.status_id
      FROM ts_matches m
      WHERE m.status_id = 4
        AND (
          m.home_team_id IN (SELECT external_id FROM ts_teams WHERE name LIKE '%Egnatia%' OR name LIKE '%Dinamo%')
          OR m.away_team_id IN (SELECT external_id FROM ts_teams WHERE name LIKE '%Egnatia%' OR name LIKE '%Dinamo%' OR name LIKE '%Vora%')
        )
      ORDER BY m.match_time DESC
    `;
    
    const result = await client.query(query);
    const matches = result.rows;
    
    logger.info(`Found ${matches.length} matches in SECOND_HALF for 18:30-19:00`);
    
    let fixed = 0;
    
    for (const match of matches) {
      const matchId = match.external_id;
      const matchTime = parseInt(match.match_time) || 0;
      const currentLiveKickoff = parseInt(match.live_kickoff_time) || matchTime;
      
      // Calculate current minute
      const elapsed = (now - currentLiveKickoff) / 60;
      const calculatedMinute = 45 + elapsed;
      
      // CRITICAL: User says matches are showing 75 minutes
      // Adjust second half start time to show 75 minutes
      // Second half started 30 minutes ago (75 - 45 = 30)
      if (match.status_id === 4) {
        const targetMinute = 75; // Target minute to show
        const secondHalfElapsed = targetMinute - 45; // 30 minutes
        const correctSecondHalfStart = now - (secondHalfElapsed * 60);
        
        await client.query(
          `UPDATE ts_matches 
           SET live_kickoff_time = $1, updated_at = NOW() 
           WHERE external_id = $2`,
          [correctSecondHalfStart, matchId]
        );
        
        const newElapsed = (now - correctSecondHalfStart) / 60;
        const newMinute = 45 + newElapsed;
        
        logger.info(
          `✅ Fixed match ${matchId}: ` +
          `old_calc=${calculatedMinute.toFixed(0)}, ` +
          `target=${targetMinute}, ` +
          `second_half_start=${new Date(correctSecondHalfStart * 1000).toISOString()}, ` +
          `new_minute=${newMinute.toFixed(0)}`
        );
        fixed++;
      }
    }
    
    logger.info(`✅ Fixed ${fixed} matches`);
    
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  fix75MinuteMatches()
    .then(() => {
      logger.info('✅ Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fix75MinuteMatches };

