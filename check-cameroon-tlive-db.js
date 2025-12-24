/**
 * Check tlive data stored in database for Cameroon match
 */
const { Pool } = require('pg');
require('dotenv').config();

const matchId = 'jw2r09hk9d3erz8'; // Cameroon match ID

async function checkTliveData() {
  console.log(`\n🔍 Checking tlive data in database for match: ${matchId}\n`);
  
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
    // Check which columns exist
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches' 
        AND column_name IN ('tlive', 'timeline')
    `);
    
    const hasTlive = columnCheck.rows.some(r => r.column_name === 'tlive');
    const hasTimeline = columnCheck.rows.some(r => r.column_name === 'timeline');
    const tliveColumn = hasTlive ? 'tlive' : (hasTimeline ? 'timeline' : null);
    
    console.log(`Available columns: tlive=${hasTlive}, timeline=${hasTimeline}`);
    console.log(`Using column: ${tliveColumn || 'NONE'}\n`);
    
    if (!tliveColumn) {
      console.log('❌ No tlive/timeline column found in database');
      return;
    }
    
    // Get match data including tlive
    const result = await client.query(
      `SELECT status_id, ${tliveColumn}, last_event_ts, provider_update_time, updated_at, match_time
       FROM ts_matches WHERE external_id = $1`,
      [matchId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Match not found in database');
      return;
    }
    
    const match = result.rows[0];
    console.log('📊 Match Status:');
    console.log(`   Status ID: ${match.status_id}`);
    console.log(`   Last Event TS: ${match.last_event_ts ? new Date(match.last_event_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Provider Update Time: ${match.provider_update_time ? new Date(match.provider_update_time * 1000).toISOString() : 'NULL'}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}\n`);
    
    const tliveData = match[tliveColumn];
    if (!tliveData) {
      console.log('⚠️  No tlive data stored in database');
      console.log('   This means WebSocket has not received any tlive messages for this match yet');
      return;
    }
    
    const tliveArray = typeof tliveData === 'string' ? JSON.parse(tliveData) : tliveData;
    
    console.log(`📊 Tlive Array (${Array.isArray(tliveArray) ? tliveArray.length : 0} entries):\n`);
    
    if (!Array.isArray(tliveArray) || tliveArray.length === 0) {
      console.log('   Empty tlive array');
      return;
    }
    
    // Show last 10 entries (most recent)
    const recentEntries = tliveArray.slice(-10);
    console.log('   Last 10 entries:');
    recentEntries.forEach((entry, idx) => {
      const dataStr = String(entry?.data || entry?.text || entry || '').toLowerCase();
      const hasHalfTime = dataStr.includes('half time') || dataStr.includes('halftime') || 
                          dataStr.includes('ht') || dataStr.includes('devre arası') || 
                          dataStr.includes('devre arasi');
      
      console.log(`   [${tliveArray.length - 10 + idx}] ${JSON.stringify(entry)} ${hasHalfTime ? '✅ HALF_TIME keyword detected!' : ''}`);
    });
    
    console.log('\n🔍 Searching for HALF_TIME keywords in all entries...\n');
    
    const halfTimeEntries = tliveArray.filter(entry => {
      const dataStr = String(entry?.data || entry?.text || entry || '').toLowerCase();
      return dataStr.includes('half time') || dataStr.includes('halftime') || 
             dataStr.includes('ht') || dataStr.includes('devre arası') || 
             dataStr.includes('devre arasi');
    });
    
    if (halfTimeEntries.length > 0) {
      console.log(`✅ Found ${halfTimeEntries.length} entries with HALF_TIME keywords:`);
      halfTimeEntries.forEach((entry, idx) => {
        console.log(`   ${idx + 1}. ${JSON.stringify(entry)}`);
      });
      console.log('\n⚠️  HALF_TIME keyword found in tlive data, but status_id is still 2 (FIRST_HALF)');
      console.log('   This suggests inferStatusFromTlive() did not detect it, or updateMatchStatusInDatabase() failed');
    } else {
      console.log('❌ No HALF_TIME keywords found in tlive data');
      console.log('   WebSocket may not have received HALF_TIME tlive message yet');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTliveData().catch(console.error);

