import { pool } from './src/database/connection';
import { TheSportsClient } from './src/services/thesports/client/thesports-client';
import dotenv from 'dotenv';
dotenv.config();

const matchId = 'x7lm7phj0yl4m2w';
const theSportsClient = new TheSportsClient();

async function fixMatchStatusFromAPI() {
  const client = await pool.connect();
  try {
    // Get real status from API
    const apiResponse: any = await theSportsClient.get('/match/detail_live', { match_id: matchId });
    
    if (apiResponse && apiResponse.results && apiResponse.results.length > 0) {
      const matchData = apiResponse.results[0];
      const scoreArray = matchData.score || [];
      const apiStatus = scoreArray[1]; // Index 1 = status_id
      const homeScore = scoreArray[2]?.[0] || 0;
      const awayScore = scoreArray[3]?.[0] || 0;
      const liveKickoff = scoreArray[4] || null;
      
      console.log(`API Status: ${apiStatus} (1=NOT_STARTED, 2=FIRST_HALF, 4=SECOND_HALF, 8=END)`);
      console.log(`API Score: ${homeScore}-${awayScore}`);
      console.log(`API Live kickoff: ${liveKickoff ? new Date(liveKickoff * 1000).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) : 'N/A'}`);
      
      // Update DB with API status
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
      
      console.log(`✅ Updated match status to ${apiStatus} from API`);
    } else {
      console.log('No data from API');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixMatchStatusFromAPI().catch(console.error);






