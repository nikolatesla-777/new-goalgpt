import { pool } from './src/database/connection';
import { TheSportsClient } from './src/services/thesports/client/thesports-client';
import dotenv from 'dotenv';
dotenv.config();

const matchIds = ['4jwq2ghnz4y5m0v', 'n54qllhnjgjeqvy']; // Egnatia vs Partizani, FC Dinamo City vs FK Vora
const theSportsClient = new TheSportsClient();

async function fixLiveMatchesStatus() {
  const client = await pool.connect();
  try {
    for (const matchId of matchIds) {
      // Get real status from API
      const apiResponse: any = await theSportsClient.get('/match/detail_live', { match_id: matchId });
      
      if (apiResponse && apiResponse.results && apiResponse.results.length > 0) {
        const matchData = apiResponse.results[0];
        const scoreArray = matchData.score || [];
        const apiStatus = scoreArray[1]; // Index 1 = status_id
        const homeScore = scoreArray[2]?.[0] || 0;
        const awayScore = scoreArray[3]?.[0] || 0;
        const liveKickoff = scoreArray[4] || null;
        
        console.log(`\nMatch ${matchId}:`);
        console.log(`  API Status: ${apiStatus} (1=NOT_STARTED, 2=FIRST_HALF, 4=SECOND_HALF, 8=END)`);
        console.log(`  API Score: ${homeScore}-${awayScore}`);
        console.log(`  API Live kickoff: ${liveKickoff ? new Date(liveKickoff * 1000).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'N/A'}`);
        
        // Check current DB status
        const dbCheck = await client.query(
          'SELECT status_id, home_score_display, away_score_display FROM ts_matches WHERE external_id = $1',
          [matchId]
        );
        
        if (dbCheck.rows.length > 0) {
          const dbStatus = dbCheck.rows[0].status_id;
          console.log(`  DB Status: ${dbStatus}`);
          
          // CRITICAL: Only update if API says match is still LIVE (status 2, 3, 4, 5, 7)
          // Do NOT update to END (8) unless API explicitly says so
          if (apiStatus >= 2 && apiStatus <= 7) {
            // Match is still LIVE - update status and scores
            await client.query(
              `UPDATE ts_matches 
               SET status_id = $1, 
                   home_score_regular = $2,
                   away_score_regular = $3,
                   home_score_display = $2,
                   away_score_display = $3,
                   live_kickoff_time = COALESCE($4, live_kickoff_time),
                   updated_at = NOW() 
               WHERE external_id = $5`,
              [apiStatus, homeScore, awayScore, liveKickoff, matchId]
            );
            
            console.log(`  ✅ Updated to LIVE status ${apiStatus} from API`);
          } else if (apiStatus === 8) {
            // API says END - update only if DB status is different
            if (dbStatus !== 8) {
              await client.query(
                `UPDATE ts_matches 
                 SET status_id = 8, 
                     home_score_regular = $1,
                     away_score_regular = $2,
                     home_score_display = $1,
                     away_score_display = $2,
                     updated_at = NOW() 
                 WHERE external_id = $3`,
                [homeScore, awayScore, matchId]
              );
              console.log(`  ✅ Updated to END (status 8) from API`);
            } else {
              console.log(`  ℹ️  Already END in DB, no update needed`);
            }
          }
        }
      } else {
        console.log(`No data from API for match ${matchId}`);
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixLiveMatchesStatus().catch(console.error);

