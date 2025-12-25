/**
 * Check why minute is NULL for live matches
 */
const { Pool } = require('pg');
require('dotenv').config();

async function checkWhyMinuteNull() {
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
    console.log('\n🔍 Checking why minute is NULL for live matches...\n');
    
    // Find live matches with NULL minute
    const result = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        provider_update_time,
        updated_at
       FROM ts_matches
       WHERE status_id IN (2, 3, 4, 5, 7)
       AND minute IS NULL
       ORDER BY match_time DESC
       LIMIT 10`
    );
    
    if (result.rows.length === 0) {
      console.log('✅ No live matches with NULL minute found');
      return;
    }
    
    console.log(`❌ Found ${result.rows.length} live matches with NULL minute:\n`);
    
    const now = Math.floor(Date.now() / 1000);
    
    for (const match of result.rows) {
      console.log(`📊 Match: ${match.external_id}`);
      console.log(`   Status: ${match.status_id}`);
      console.log(`   Minute: NULL`);
      console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
      console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
      console.log(`   Second Half Kickoff: ${match.second_half_kickoff_ts ? new Date(match.second_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
      console.log(`   Provider Update Time: ${match.provider_update_time ? new Date(match.provider_update_time * 1000).toISOString() : 'NULL'}`);
      console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
      
      // Check if we can calculate minute
      if (match.status_id === 2 && match.first_half_kickoff_ts) {
        const calculated = Math.floor((now - match.first_half_kickoff_ts) / 60) + 1;
        const clamped = Math.min(calculated, 45);
        console.log(`   💡 Can calculate: ${clamped} minutes (from first_half_kickoff_ts)`);
        console.log(`   → reconcileMatchToDatabase should set this!`);
      } else if (match.status_id === 4 && match.second_half_kickoff_ts) {
        const calculated = Math.floor((now - match.second_half_kickoff_ts) / 60) + 1;
        const clamped = Math.min(calculated, 90);
        console.log(`   💡 Can calculate: ${clamped} minutes (from second_half_kickoff_ts)`);
        console.log(`   → reconcileMatchToDatabase should set this!`);
      } else {
        console.log(`   ❌ Cannot calculate: Missing kickoff timestamp`);
        console.log(`   → Need to set kickoff_ts first via reconcileMatchToDatabase`);
      }
      
      console.log('');
    }
    
    console.log('💡 Solution:');
    console.log('   1. MatchSyncWorker should reconcile these matches');
    console.log('   2. reconcileMatchToDatabase should set minute from kickoff_ts');
    console.log('   3. Check MatchSyncWorker logs to see if it\'s running');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkWhyMinuteNull().catch(console.error);

