/**
 * Debug script to check why minute is NULL for a specific match
 */
const { Pool } = require('pg');
require('dotenv').config();

const matchId = process.argv[2] || 'vjxm8ghe5205r6'; // Default: Vietnam U19 match

async function debugMatch() {
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
    console.log(`\n🔍 Debugging match: ${matchId}\n`);
    
    // Try to find match by external_id
    let result = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        overtime_kickoff_ts,
        live_kickoff_time,
        provider_update_time,
        updated_at
       FROM ts_matches
       WHERE external_id = $1`,
      [matchId]
    );
    
    // If not found, try to find by partial match (in case ID is truncated)
    if (result.rows.length === 0) {
      console.log(`⚠️  Match not found with exact ID: ${matchId}`);
      console.log(`   Trying to find matches with similar ID...\n`);
      
      result = await client.query(
        `SELECT 
          external_id,
          status_id,
          minute,
          match_time,
          first_half_kickoff_ts,
          second_half_kickoff_ts,
          overtime_kickoff_ts,
          live_kickoff_time,
          provider_update_time,
          updated_at
         FROM ts_matches
         WHERE external_id LIKE $1
         ORDER BY match_time DESC
         LIMIT 5`,
        [`${matchId}%`]
      );
      
      if (result.rows.length === 0) {
        console.log('❌ Match not found even with partial match');
        console.log(`   Searched for: ${matchId}`);
        return;
      } else {
        console.log(`✅ Found ${result.rows.length} match(es) with similar ID. Using first match.\n`);
      }
    }
    
    const match = result.rows[0];
    console.log('📊 Database State:');
    console.log(`   External ID: ${match.external_id}`);
    console.log(`   Status: ${match.status_id}`);
    console.log(`   Minute: ${match.minute}`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
    console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Second Half Kickoff: ${match.second_half_kickoff_ts ? new Date(match.second_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Overtime Kickoff: ${match.overtime_kickoff_ts ? new Date(match.overtime_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Live Kickoff Time: ${match.live_kickoff_time ? new Date(match.live_kickoff_time * 1000).toISOString() : 'NULL'}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
    console.log('');
    
    // Calculate expected minute
    const now = Math.floor(Date.now() / 1000);
    console.log('💡 Minute Calculation:');
    
    if (match.status_id === 2 && match.first_half_kickoff_ts) {
      const calculated = Math.floor((now - match.first_half_kickoff_ts) / 60) + 1;
      const clamped = Math.min(calculated, 45);
      console.log(`   Status 2 (FIRST_HALF): ${clamped} (from first_half_kickoff_ts)`);
    } else if (match.status_id === 3) {
      console.log(`   Status 3 (HALF_TIME): 45 (frozen)`);
    } else if (match.status_id === 4) {
      if (match.second_half_kickoff_ts) {
        const calculated = 45 + Math.floor((now - match.second_half_kickoff_ts) / 60) + 1;
        const clamped = Math.max(calculated, 46);
        console.log(`   Status 4 (SECOND_HALF): ${clamped} (from second_half_kickoff_ts)`);
        console.log(`   → Second half started: ${new Date(match.second_half_kickoff_ts * 1000).toISOString()}`);
        console.log(`   → Elapsed since 2H start: ${Math.floor((now - match.second_half_kickoff_ts) / 60)} minutes`);
      } else {
        console.log(`   Status 4 (SECOND_HALF): Cannot calculate - second_half_kickoff_ts is NULL`);
      }
    } else if (match.status_id === 5 && match.overtime_kickoff_ts) {
      const calculated = 90 + Math.floor((now - match.overtime_kickoff_ts) / 60) + 1;
      console.log(`   Status 5 (OVERTIME): ${calculated} (from overtime_kickoff_ts)`);
    }
    
    console.log('');
    
    // Check if match should be found by fix script
    const shouldBeFound = 
      (match.status_id === 4 && match.second_half_kickoff_ts && match.minute === null) ||
      (match.status_id === 2 && match.first_half_kickoff_ts && match.minute === null) ||
      (match.status_id === 3 && match.minute === null) ||
      (match.status_id === 5 && match.overtime_kickoff_ts && match.minute === null);
    
    console.log('🔍 Query Check:');
    console.log(`   Should be found by fix script: ${shouldBeFound ? '✅ YES' : '❌ NO'}`);
    
    if (match.status_id === 4 && match.second_half_kickoff_ts && match.minute === null) {
      console.log(`   → Status 4, second_half_kickoff_ts exists, minute is NULL`);
      console.log(`   → Fix script should calculate and set minute`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

debugMatch().catch(console.error);

