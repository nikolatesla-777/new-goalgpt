/**
 * Force reconcile a match via detail_live - Direct database update
 */
const { Pool } = require('pg');
require('dotenv').config();

async function forceReconcile() {
  const matchId = 'k82rekhgxp2grep';
  console.log(`\n🔄 Force updating first_half_kickoff_ts for match ${matchId}...\n`);
  
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    // Get match_time
    const matchResult = await client.query(
      'SELECT match_time, status_id FROM ts_matches WHERE external_id = $1',
      [matchId]
    );
    
    if (matchResult.rows.length === 0) {
      console.log('❌ Match not found');
      return;
    }
    
    const match = matchResult.rows[0];
    console.log('Current match status:', match.status_id);
    console.log('Match time:', new Date(match.match_time * 1000).toISOString());
    
    // Set first_half_kickoff_ts to match_time if NULL
    if (match.status_id === 2 || match.status_id === 3 || match.status_id === 4) {
      const updateResult = await client.query(
        `UPDATE ts_matches 
         SET first_half_kickoff_ts = COALESCE(first_half_kickoff_ts, match_time),
             updated_at = NOW()
         WHERE external_id = $1 AND first_half_kickoff_ts IS NULL`,
        [matchId]
      );
      
      console.log('Update result:', updateResult.rowCount, 'rows affected');
      
      if (updateResult.rowCount > 0) {
        console.log('✅ first_half_kickoff_ts set to match_time');
      } else {
        console.log('⚠️ first_half_kickoff_ts already set or match not found');
      }
    } else {
      console.log('⚠️ Match status is not LIVE (status_id should be 2, 3, or 4)');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

forceReconcile();
