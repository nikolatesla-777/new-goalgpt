/**
 * Find Boliyohuto match and check minute
 */
const { Pool } = require('pg');
require('dotenv').config();

async function findMatch() {
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
    // Find match by team name
    const result = await client.query(
      `SELECT 
        m.external_id,
        m.status_id,
        m.minute,
        m.match_time,
        m.first_half_kickoff_ts,
        m.second_half_kickoff_ts,
        m.overtime_kickoff_ts,
        m.live_kickoff_time,
        m.provider_update_time,
        m.last_event_ts,
        m.updated_at,
        m.home_score_regular,
        m.away_score_regular,
        ht.name as home_team_name,
        at.name as away_team_name
       FROM ts_matches m
       LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
       LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
       WHERE (ht.name ILIKE '%Boliyohuto%' OR at.name ILIKE '%Boliyohuto%' 
              OR ht.name ILIKE '%Bongoayu%' OR at.name ILIKE '%Bongoayu%')
         AND m.status_id IN (2, 3, 4, 5, 7)
       ORDER BY m.match_time DESC
       LIMIT 5`
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No live matches found for Boliyohuto/Bongoayu');
      return;
    }
    
    console.log(`\n✅ Found ${result.rows.length} match(es):\n`);
    
    for (const match of result.rows) {
      console.log(`📊 Match: ${match.home_team_name} vs ${match.away_team_name}`);
      console.log(`   ID: ${match.external_id}`);
      console.log(`   Status: ${match.status_id}`);
      console.log(`   Minute: ${match.minute}`);
      console.log(`   Score: ${match.home_score_regular || 0} - ${match.away_score_regular || 0}`);
      console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
      console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
      console.log(`   Second Half Kickoff: ${match.second_half_kickoff_ts ? new Date(match.second_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
      console.log(`   Provider Update Time: ${match.provider_update_time ? new Date(match.provider_update_time * 1000).toISOString() : 'NULL'}`);
      console.log(`   Last Event TS: ${match.last_event_ts ? new Date(match.last_event_ts * 1000).toISOString() : 'NULL'}`);
      console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
      
      // Calculate expected minute
      const now = Math.floor(Date.now() / 1000);
      if (match.status_id === 2 && match.first_half_kickoff_ts) {
        const calculated = Math.floor((now - match.first_half_kickoff_ts) / 60) + 1;
        const clamped = Math.min(calculated, 45);
        console.log(`   💡 Expected minute (FIRST_HALF): ${clamped}`);
      } else if (match.status_id === 4 && match.second_half_kickoff_ts) {
        const calculated = 45 + Math.floor((now - match.second_half_kickoff_ts) / 60) + 1;
        const clamped = Math.max(calculated, 46);
        console.log(`   💡 Expected minute (SECOND_HALF): ${clamped}`);
      } else if (match.status_id === 3) {
        console.log(`   💡 Expected minute (HALF_TIME): 45`);
      }
      
      if (match.minute === null) {
        console.log(`   ⚠️  PROBLEM: Minute is NULL!`);
        if (match.status_id === 4 && !match.second_half_kickoff_ts) {
          console.log(`   → Missing second_half_kickoff_ts - cannot calculate minute`);
        } else if (match.status_id === 2 && !match.first_half_kickoff_ts) {
          console.log(`   → Missing first_half_kickoff_ts - cannot calculate minute`);
        }
      }
      
      console.log('');
    }
    
    // Now check provider for the first match
    if (result.rows.length > 0) {
      const matchId = result.rows[0].external_id;
      console.log(`\n🔍 Checking provider for match: ${matchId}\n`);
      
      const https = require('https');
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
      let providerStatusId = null;
      let providerMinute = null;
      
      if (Array.isArray(providerMatch.score)) {
        providerStatusId = providerMatch.score[1];
        console.log(`   Status ID (from score[1]): ${providerStatusId}`);
      }
      
      providerMinute = providerMatch.minute ?? providerMatch.match_minute ?? providerMatch.match?.minute ?? null;
      console.log(`   Minute (from root.minute): ${providerMatch.minute}`);
      console.log(`   Minute (from root.match_minute): ${providerMatch.match_minute}`);
      console.log(`   Minute (from root.match.minute): ${providerMatch.match?.minute}`);
      console.log(`   → Extracted minute: ${providerMinute}`);
      console.log('');
      
      const dbMatch = result.rows[0];
      console.log('📊 Comparison:');
      console.log(`   DB Minute: ${dbMatch.minute}`);
      console.log(`   Provider Minute: ${providerMinute}`);
      console.log(`   Status Match: ${dbMatch.status_id === providerStatusId ? '✅' : '❌'} (DB: ${dbMatch.status_id}, Provider: ${providerStatusId})`);
      
      if (dbMatch.minute === null && providerMinute !== null) {
        console.log('\n⚠️  PROBLEM: Database minute is NULL but provider supplies minute!');
        console.log('   → reconcileMatchToDatabase() should have set this');
      } else if (dbMatch.minute === null && providerMinute === null) {
        console.log('\n⚠️  Provider does not supply minute - should calculate from kickoff timestamps');
        if (dbMatch.status_id === 4 && dbMatch.second_half_kickoff_ts) {
          const calculated = 45 + Math.floor((Math.floor(Date.now() / 1000) - dbMatch.second_half_kickoff_ts) / 60) + 1;
          console.log(`   → Should calculate: ${Math.max(calculated, 46)} from second_half_kickoff_ts`);
        }
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

findMatch().catch(console.error);

