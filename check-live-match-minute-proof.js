/**
 * Proof script: Check if live match minute is correct
 * Compares database minute with provider minute
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

async function checkLiveMatchMinute() {
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
    console.log('\n🔍 Finding live matches (Sidosel vs Persidago Gorontalo)...\n');
    
    // Find the match by team names
    const dbResult = await client.query(
      `SELECT 
        m.external_id,
        m.status_id,
        m.minute,
        m.match_time,
        m.first_half_kickoff_ts,
        m.second_half_kickoff_ts,
        m.live_kickoff_time,
        m.provider_update_time,
        m.last_event_ts,
        m.updated_at,
        ht.name as home_team,
        at.name as away_team
       FROM ts_matches m
       LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
       LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
       WHERE m.status_id IN (2, 3, 4, 5, 7)
         AND (
           LOWER(ht.name) LIKE '%sidosel%' 
           OR LOWER(at.name) LIKE '%persidago%'
           OR LOWER(ht.name) LIKE '%persidago%'
           OR LOWER(at.name) LIKE '%sidosel%'
         )
       ORDER BY m.match_time DESC
       LIMIT 5`
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found in database');
      console.log('   Trying to find any live match...\n');
      
      // Fallback: find any live match
      const anyLiveResult = await client.query(
        `SELECT 
          m.external_id,
          m.status_id,
          m.minute,
          m.match_time,
          m.first_half_kickoff_ts,
          m.second_half_kickoff_ts,
          m.live_kickoff_time,
          m.provider_update_time,
          m.last_event_ts,
          m.updated_at,
          ht.name as home_team,
          at.name as away_team
         FROM ts_matches m
         LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
         LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
         WHERE m.status_id IN (2, 3, 4, 5, 7)
         ORDER BY m.match_time DESC
         LIMIT 1`
      );
      
      if (anyLiveResult.rows.length === 0) {
        console.log('❌ No live matches found in database');
        return;
      }
      
      dbResult.rows = anyLiveResult.rows;
    }
    
    const match = dbResult.rows[0];
    console.log('📊 Database State:');
    console.log(`   Match ID: ${match.external_id}`);
    console.log(`   Teams: ${match.home_team || 'Unknown'} vs ${match.away_team || 'Unknown'}`);
    console.log(`   Status: ${match.status_id} (${getStatusName(match.status_id)})`);
    console.log(`   Minute (DB): ${match.minute !== null ? match.minute : 'NULL'}`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
    console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Second Half Kickoff: ${match.second_half_kickoff_ts ? new Date(match.second_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Live Kickoff Time: ${match.live_kickoff_time ? new Date(match.live_kickoff_time * 1000).toISOString() : 'NULL'}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
    console.log('');
    
    // Calculate expected minute from kickoff timestamps
    const now = Math.floor(Date.now() / 1000);
    console.log('💡 Calculated Minute (from kickoff timestamps):');
    
    let calculatedMinute = null;
    if (match.status_id === 2 && match.first_half_kickoff_ts) {
      calculatedMinute = Math.floor((now - match.first_half_kickoff_ts) / 60) + 1;
      calculatedMinute = Math.min(calculatedMinute, 45);
      console.log(`   Status 2 (FIRST_HALF): ${calculatedMinute} minutes`);
      console.log(`   → First half started: ${new Date(match.first_half_kickoff_ts * 1000).toISOString()}`);
      console.log(`   → Elapsed: ${Math.floor((now - match.first_half_kickoff_ts) / 60)} minutes`);
    } else if (match.status_id === 3) {
      calculatedMinute = 45;
      console.log(`   Status 3 (HALF_TIME): 45 (frozen)`);
    } else if (match.status_id === 4 && match.second_half_kickoff_ts) {
      calculatedMinute = 45 + Math.floor((now - match.second_half_kickoff_ts) / 60) + 1;
      calculatedMinute = Math.max(calculatedMinute, 46);
      console.log(`   Status 4 (SECOND_HALF): ${calculatedMinute} minutes`);
      console.log(`   → Second half started: ${new Date(match.second_half_kickoff_ts * 1000).toISOString()}`);
      console.log(`   → Elapsed since 2H start: ${Math.floor((now - match.second_half_kickoff_ts) / 60)} minutes`);
    }
    console.log('');
    
    // Get provider data
    const user = process.env.THESPORTS_API_USER || '';
    const secret = process.env.THESPORTS_API_SECRET || '';
    
    const detailUrl = new URL('/v1/football/match/detail_live', 'https://api.thesports.com');
    detailUrl.searchParams.set('user', user);
    detailUrl.searchParams.set('secret', secret);
    detailUrl.searchParams.set('match_id', match.external_id);
    
    console.log('🌐 Fetching from provider...');
    const providerResponse = await makeRequest(detailUrl.pathname + detailUrl.search);
    
    if (providerResponse.err) {
      console.log(`❌ Provider API Error: ${providerResponse.err}`);
      return;
    }
    
    // Extract match from response
    let providerMatch = null;
    if (Array.isArray(providerResponse.results)) {
      providerMatch = providerResponse.results.find(m => String(m.id || m.match_id) === String(match.external_id));
    } else if (providerResponse.results && typeof providerResponse.results === 'object') {
      providerMatch = providerResponse.results;
    }
    
    if (!providerMatch) {
      console.log('❌ Match not found in provider response');
      return;
    }
    
    // Parse provider data
    let providerStatusId = null;
    let providerMinute = null;
    let providerHomeScore = null;
    let providerAwayScore = null;
    
    if (Array.isArray(providerMatch.score)) {
      providerStatusId = providerMatch.score[1];
      providerHomeScore = Array.isArray(providerMatch.score[2]) ? providerMatch.score[2][0] : null;
      providerAwayScore = Array.isArray(providerMatch.score[3]) ? providerMatch.score[3][0] : null;
    }
    
    // Extract minute from provider
    providerMinute = providerMatch.minute || providerMatch.match_minute || null;
    
    console.log('📊 Provider State:');
    console.log(`   Status: ${providerStatusId} (${getStatusName(providerStatusId)})`);
    console.log(`   Minute (Provider): ${providerMinute !== null ? providerMinute : 'NULL'}`);
    console.log(`   Score: ${providerHomeScore} - ${providerAwayScore}`);
    if (Array.isArray(providerMatch.score)) {
      console.log(`   Score Array: [${providerMatch.score[0]}, ${providerMatch.score[1]}, [...], [...], ${providerMatch.score[4] || 'N/A'}]`);
    }
    console.log('');
    
    // Comparison
    console.log('🔍 PROOF - Minute Comparison:');
    console.log(`   Database Minute: ${match.minute !== null ? match.minute : 'NULL'}`);
    console.log(`   Provider Minute: ${providerMinute !== null ? providerMinute : 'NULL'}`);
    console.log(`   Calculated Minute: ${calculatedMinute !== null ? calculatedMinute : 'NULL'}`);
    console.log('');
    
    if (match.minute !== null && providerMinute !== null) {
      const diff = Math.abs(match.minute - providerMinute);
      if (diff <= 1) {
        console.log(`   ✅ MATCH: Database minute (${match.minute}) matches provider minute (${providerMinute})`);
        console.log(`   → Difference: ${diff} minute(s) (acceptable)`);
      } else {
        console.log(`   ⚠️  MISMATCH: Database minute (${match.minute}) differs from provider minute (${providerMinute})`);
        console.log(`   → Difference: ${diff} minute(s) (may need update)`);
      }
    } else if (match.minute !== null && calculatedMinute !== null) {
      const diff = Math.abs(match.minute - calculatedMinute);
      if (diff <= 1) {
        console.log(`   ✅ MATCH: Database minute (${match.minute}) matches calculated minute (${calculatedMinute})`);
        console.log(`   → Difference: ${diff} minute(s) (acceptable)`);
      } else {
        console.log(`   ⚠️  MISMATCH: Database minute (${match.minute}) differs from calculated minute (${calculatedMinute})`);
        console.log(`   → Difference: ${diff} minute(s) (may need update)`);
      }
    } else if (match.minute === null) {
      console.log(`   ❌ Database minute is NULL - needs calculation or provider update`);
    } else if (providerMinute === null && calculatedMinute === null) {
      console.log(`   ⚠️  Cannot verify: Both provider and calculated minutes are NULL`);
    }
    
    console.log('');
    console.log('💡 Frontend Display:');
    console.log(`   The frontend should show: ${match.minute !== null ? match.minute : 'NULL'} minute(s)`);
    console.log(`   Status: ${getStatusName(match.status_id)}`);
    if (match.status_id === 2) {
      console.log(`   Display: "1. Yarı" (First Half)`);
    } else if (match.status_id === 4) {
      console.log(`   Display: "2. Yarı" (Second Half)`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

function getStatusName(statusId) {
  const statusMap = {
    1: 'NOT_STARTED',
    2: 'FIRST_HALF',
    3: 'HALF_TIME',
    4: 'SECOND_HALF',
    5: 'OVERTIME',
    7: 'PENALTY_SHOOTOUT',
    8: 'END'
  };
  return statusMap[statusId] || 'UNKNOWN';
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

checkLiveMatchMinute().catch(console.error);

