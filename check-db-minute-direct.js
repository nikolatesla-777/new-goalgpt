/**
 * Direct database check for minute value
 */
const { Pool } = require('pg');
require('dotenv').config();

async function checkDbMinute() {
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
    console.log('\n🔍 Direct database check for Ninh Binh match...\n');
    
    const result = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        updated_at
       FROM ts_matches
       WHERE external_id = '318q66hx67dlqo9'`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Match not found');
      return;
    }
    
    const match = result.rows[0];
    const now = Math.floor(Date.now() / 1000);
    
    console.log('📊 Database (Direct Query):');
    console.log(`   Status: ${match.status_id}`);
    console.log(`   Minute: ${match.minute !== null ? match.minute : 'NULL'}`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
    console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
    console.log('');
    
    // Calculate expected minute
    if (match.status_id === 2 && match.first_half_kickoff_ts) {
      const calculated = Math.floor((now - match.first_half_kickoff_ts) / 60) + 1;
      const clamped = Math.min(calculated, 45);
      console.log('💡 Expected Minute:');
      console.log(`   Calculated: ${clamped} minutes`);
      console.log(`   Database: ${match.minute !== null ? match.minute : 'NULL'}`);
      console.log('');
      
      if (match.minute === null) {
        console.log('❌ PROBLEM: Database minute is NULL but should be calculated!');
        console.log(`   → Fix: Update minute to ${clamped}`);
        
        // Fix it
        await client.query(
          `UPDATE ts_matches 
           SET minute = $1, updated_at = NOW() 
           WHERE external_id = $2`,
          [clamped, match.external_id]
        );
        
        console.log(`   ✅ Fixed: Set minute to ${clamped}`);
        
        // Verify
        const verifyResult = await client.query(
          `SELECT minute FROM ts_matches WHERE external_id = $1`,
          [match.external_id]
        );
        
        console.log(`   Verified: minute = ${verifyResult.rows[0].minute}`);
      } else if (Math.abs(match.minute - clamped) > 2) {
        console.log(`⚠️  WARNING: Database minute (${match.minute}) differs from calculated (${clamped}) by more than 2 minutes`);
      } else {
        console.log(`✅ Database minute (${match.minute}) matches calculated (${clamped})`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDbMinute().catch(console.error);

