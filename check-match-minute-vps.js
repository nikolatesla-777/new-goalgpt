/**
 * Check minute value for a specific match in database and from provider
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

// Get match ID from command line or use default
const matchId = process.argv[2] || 'k82rekhgxp2grep'; // Default: Tocantinopolis match

async function checkMatchMinute() {
  console.log(`\n🔍 Checking minute for match: ${matchId}\n`);
  
  // Check database
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
    const dbResult = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        overtime_kickoff_ts,
        live_kickoff_time,
        provider_update_time,
        last_event_ts,
        updated_at,
        home_score_regular,
        away_score_regular
       FROM ts_matches 
       WHERE external_id = $1`,
      [matchId]
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found in database');
      return;
    }
    
    const match = dbResult.rows[0];
    console.log('📊 Database Status:');
    console.log(`   Match ID: ${match.external_id}`);
    console.log(`   Status ID: ${match.status_id}`);
    console.log(`   Minute: ${match.minute}`);
    console.log(`   Match Minute: ${match.match_minute}`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
    console.log(`   First Half Kickoff TS: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Second Half Kickoff TS: ${match.second_half_kickoff_ts ? new Date(match.second_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Overtime Kickoff TS: ${match.overtime_kickoff_ts ? new Date(match.overtime_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Live Kickoff Time: ${match.live_kickoff_time ? new Date(match.live_kickoff_time * 1000).toISOString() : 'NULL'}`);
    console.log(`   Provider Update Time: ${match.provider_update_time ? new Date(match.provider_update_time * 1000).toISOString() : 'NULL'}`);
    console.log(`   Last Event TS: ${match.last_event_ts ? new Date(match.last_event_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
    console.log(`   Score: ${match.home_score_regular || 0} - ${match.away_score_regular || 0}`);
    console.log('');
    
    // Calculate expected minute from kickoff timestamps
    const now = Math.floor(Date.now() / 1000);
    if (match.status_id === 2 && match.first_half_kickoff_ts) {
      const calculated = Math.floor((now - match.first_half_kickoff_ts) / 60) + 1;
      const clamped = Math.min(calculated, 45);
      console.log(`   💡 Expected minute (FIRST_HALF): ${clamped} (calculated from first_half_kickoff_ts)`);
    } else if (match.status_id === 4 && match.second_half_kickoff_ts) {
      const calculated = 45 + Math.floor((now - match.second_half_kickoff_ts) / 60) + 1;
      const clamped = Math.max(calculated, 46);
      console.log(`   💡 Expected minute (SECOND_HALF): ${clamped} (calculated from second_half_kickoff_ts)`);
    } else if (match.status_id === 3) {
      console.log(`   💡 Expected minute (HALF_TIME): 45 (frozen)`);
    } else if (match.status_id === 5 && match.overtime_kickoff_ts) {
      const calculated = 90 + Math.floor((now - match.overtime_kickoff_ts) / 60) + 1;
      console.log(`   💡 Expected minute (OVERTIME): ${calculated} (calculated from overtime_kickoff_ts)`);
    }
    console.log('');
    
    // Check provider
    console.log('📊 Checking provider endpoint...\n');
    const user = process.env.THESPORTS_API_USER || '';
    const secret = process.env.THESPORTS_API_SECRET || '';
    
    const detailUrl = new URL('/v1/football/match/detail_live', 'https://api.thesports.com');
    detailUrl.searchParams.set('user', user);
    detailUrl.searchParams.set('secret', secret);
    detailUrl.searchParams.set('match_id', matchId);
    
    const providerResponse = await makeRequest(detailUrl.pathname + detailUrl.search);
    
    if (providerResponse.err) {
      console.error('❌ Provider API Error:', providerResponse.err);
      return;
    }
    
    // Extract match from response
    let providerMatch = null;
    if (Array.isArray(providerResponse.results)) {
      providerMatch = providerResponse.results.find(m => String(m.id || m.match_id) === String(matchId));
    } else if (providerResponse.results && typeof providerResponse.results === 'object') {
      providerMatch = providerResponse.results;
    }
    
    if (!providerMatch) {
      console.log('❌ Match not found in provider response');
      return;
    }
    
    console.log('📊 Provider Response:');
    
    // Parse score array
    let providerStatusId = null;
    let providerMinute = null;
    let providerKickoffTs = null;
    
    if (Array.isArray(providerMatch.score)) {
      providerStatusId = providerMatch.score[1];
      providerKickoffTs = providerMatch.score[4];
      console.log(`   Status ID (from score[1]): ${providerStatusId}`);
      console.log(`   Kick-off timestamp (from score[4]): ${providerKickoffTs} (${providerKickoffTs ? new Date(providerKickoffTs * 1000).toISOString() : 'N/A'})`);
    }
    
    // Check minute fields
    providerMinute = providerMatch.minute ?? providerMatch.match_minute ?? providerMatch.match?.minute ?? null;
    console.log(`   Minute (from root.minute): ${providerMatch.minute}`);
    console.log(`   Minute (from root.match_minute): ${providerMatch.match_minute}`);
    console.log(`   Minute (from root.match.minute): ${providerMatch.match?.minute}`);
    console.log(`   → Extracted minute: ${providerMinute}`);
    console.log('');
    
    // Compare
    console.log('📊 Comparison:');
    console.log(`   DB Minute: ${match.minute}`);
    console.log(`   Provider Minute: ${providerMinute}`);
    console.log(`   Status Match: ${match.status_id === providerStatusId ? '✅' : '❌'} (DB: ${match.status_id}, Provider: ${providerStatusId})`);
    
    if (match.minute === null && providerMinute !== null) {
      console.log('\n⚠️  PROBLEM: Database minute is NULL but provider supplies minute!');
      console.log('   → reconcileMatchToDatabase() should set minute from provider');
    } else if (match.minute === null && providerMinute === null) {
      console.log('\n⚠️  Provider does not supply minute - should calculate from kickoff timestamps');
      if (match.status_id === 2 && match.first_half_kickoff_ts) {
        console.log('   → calculateMinuteFromKickoffs() should calculate for FIRST_HALF');
      } else if (match.status_id === 4 && match.second_half_kickoff_ts) {
        console.log('   → calculateMinuteFromKickoffs() should calculate for SECOND_HALF');
      } else {
        console.log('   → Missing kickoff timestamps - cannot calculate minute');
      }
    } else if (match.minute !== null) {
      console.log('\n✅ Database has minute value');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'https://api.thesports.com');
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}\nData: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

checkMatchMinute().catch(console.error);

