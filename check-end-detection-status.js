/**
 * Check if END detection is working correctly
 * Verifies MatchSyncWorker is running and reconciling SECOND_HALF matches
 */
const { Pool } = require('pg');
require('dotenv').config();

async function checkEndDetection() {
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
    console.log('\n🔍 Checking END Detection Status...\n');
    
    // Check for SECOND_HALF matches that should be END
    const secondHalfResult = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        provider_update_time,
        last_event_ts,
        updated_at,
        NOW() - updated_at as time_since_update
       FROM ts_matches
       WHERE status_id = 4
       ORDER BY match_time DESC
       LIMIT 10`
    );
    
    console.log(`📊 Found ${secondHalfResult.rows.length} SECOND_HALF (status 4) matches:\n`);
    
    for (const match of secondHalfResult.rows) {
      const timeSinceUpdate = match.time_since_update;
      const hours = Math.floor(timeSinceUpdate.seconds / 3600);
      const minutes = Math.floor((timeSinceUpdate.seconds % 3600) / 60);
      
      console.log(`   Match: ${match.external_id.substring(0, 12)}...`);
      console.log(`   Status: ${match.status_id} (SECOND_HALF)`);
      console.log(`   Minute: ${match.minute}`);
      console.log(`   Last Updated: ${hours}h ${minutes}m ago`);
      console.log(`   Provider Update Time: ${match.provider_update_time || 'NULL'}`);
      console.log(`   Last Event TS: ${match.last_event_ts || 'NULL'}`);
      console.log('');
    }
    
    // Check for recently ENDED matches
    const endResult = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        provider_update_time,
        last_event_ts,
        updated_at,
        NOW() - updated_at as time_since_update
       FROM ts_matches
       WHERE status_id = 8
       ORDER BY updated_at DESC
       LIMIT 5`
    );
    
    console.log(`📊 Recently ENDED (status 8) matches:\n`);
    
    for (const match of endResult.rows) {
      const timeSinceUpdate = match.time_since_update;
      const hours = Math.floor(timeSinceUpdate.seconds / 3600);
      const minutes = Math.floor((timeSinceUpdate.seconds % 3600) / 60);
      
      console.log(`   Match: ${match.external_id.substring(0, 12)}...`);
      console.log(`   Status: ${match.status_id} (END)`);
      console.log(`   Minute: ${match.minute}`);
      console.log(`   Ended: ${hours}h ${minutes}m ago`);
      console.log(`   Provider Update Time: ${match.provider_update_time || 'NULL'}`);
      console.log(`   Last Event TS: ${match.last_event_ts || 'NULL'}`);
      console.log('');
    }
    
    // Check for suspicious matches (SECOND_HALF but very old)
    const suspiciousResult = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        updated_at,
        NOW() - updated_at as time_since_update
       FROM ts_matches
       WHERE status_id = 4
         AND updated_at < NOW() - INTERVAL '2 hours'
       ORDER BY updated_at ASC
       LIMIT 5`
    );
    
    if (suspiciousResult.rows.length > 0) {
      console.log(`⚠️  WARNING: Found ${suspiciousResult.rows.length} SECOND_HALF matches not updated in 2+ hours:\n`);
      
      for (const match of suspiciousResult.rows) {
        const timeSinceUpdate = match.time_since_update;
        const hours = Math.floor(timeSinceUpdate.seconds / 3600);
        
        console.log(`   Match: ${match.external_id.substring(0, 12)}...`);
        console.log(`   Not updated for: ${hours} hours`);
        console.log(`   → These matches may be END but not detected`);
        console.log('');
      }
    } else {
      console.log('✅ No suspicious SECOND_HALF matches found (all updated recently)\n');
    }
    
    console.log('💡 Expected Behavior:');
    console.log('   - MatchSyncWorker reconciles SECOND_HALF matches every 15 seconds');
    console.log('   - When provider says END (8), database should update within 15 seconds');
    console.log('   - If matches are stuck in SECOND_HALF for 2+ hours, END detection may not be working');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkEndDetection().catch(console.error);

