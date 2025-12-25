/**
 * Check why a match that should be live is not appearing in live matches
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

async function checkMatchNotLive() {
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
    console.log('\n🔍 Finding match: Ninh Binh U19 vs Hoai Duc U19...\n');
    
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
       WHERE (
         LOWER(ht.name) LIKE '%ninh binh%' 
         OR LOWER(at.name) LIKE '%ninh binh%'
         OR LOWER(ht.name) LIKE '%hoai duc%'
         OR LOWER(at.name) LIKE '%hoai duc%'
       )
       ORDER BY m.match_time DESC
       LIMIT 5`
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found in database');
      return;
    }
    
    const match = dbResult.rows[0];
    const now = Math.floor(Date.now() / 1000);
    const matchTime = match.match_time;
    const timeSinceMatchTime = now - matchTime;
    const minutesSinceMatchTime = Math.floor(timeSinceMatchTime / 60);
    
    console.log('📊 Database State:');
    console.log(`   Match ID: ${match.external_id}`);
    console.log(`   Teams: ${match.home_team || 'Unknown'} vs ${match.away_team || 'Unknown'}`);
    console.log(`   Status: ${match.status_id} (${getStatusName(match.status_id)})`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
    console.log(`   Time Since Match Time: ${minutesSinceMatchTime} minutes (${Math.floor(timeSinceMatchTime / 3600)} hours)`);
    console.log(`   Minute: ${match.minute !== null ? match.minute : 'NULL'}`);
    console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
    console.log('');
    
    // Check if match should be live
    console.log('🔍 Analysis:');
    if (match.status_id === 1 && minutesSinceMatchTime > 0 && minutesSinceMatchTime < 150) {
      console.log(`   ⚠️  PROBLEM: Match should be LIVE but status is NOT_STARTED (1)`);
      console.log(`   → Match time was ${minutesSinceMatchTime} minutes ago`);
      console.log(`   → Status should be FIRST_HALF (2) or later`);
      console.log(`   → This match should appear in live matches but doesn't`);
    } else if (match.status_id === 1 && minutesSinceMatchTime < 0) {
      console.log(`   ℹ️  Match hasn't started yet (${Math.abs(minutesSinceMatchTime)} minutes until match time)`);
    } else if ([2, 3, 4, 5, 7].includes(match.status_id)) {
      console.log(`   ✅ Match is LIVE (status ${match.status_id})`);
      console.log(`   → Should appear in live matches`);
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
      console.log(`   → Provider may not have this match in detail_live yet`);
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
    
    providerMinute = providerMatch.minute || providerMatch.match_minute || null;
    
    console.log('📊 Provider State:');
    console.log(`   Status: ${providerStatusId} (${getStatusName(providerStatusId)})`);
    console.log(`   Minute: ${providerMinute !== null ? providerMinute : 'NULL'}`);
    console.log(`   Score: ${providerHomeScore} - ${providerAwayScore}`);
    console.log('');
    
    // Comparison
    console.log('🔍 Status Comparison:');
    if (providerStatusId === match.status_id) {
      console.log(`   ✅ Status matches: ${match.status_id}`);
    } else {
      console.log(`   ❌ STATUS MISMATCH:`);
      console.log(`      DB: ${match.status_id} (${getStatusName(match.status_id)})`);
      console.log(`      Provider: ${providerStatusId} (${getStatusName(providerStatusId)})`);
      
      if (providerStatusId === 2 && match.status_id === 1) {
        console.log(`   🚨 CRITICAL: Provider says FIRST_HALF but DB says NOT_STARTED!`);
        console.log(`   → Match should be updated to FIRST_HALF (2)`);
        console.log(`   → ProactiveMatchStatusCheckWorker should detect this`);
      } else if (providerStatusId === 4 && match.status_id === 1) {
        console.log(`   🚨 CRITICAL: Provider says SECOND_HALF but DB says NOT_STARTED!`);
        console.log(`   → Match should be updated to SECOND_HALF (4)`);
      }
    }
    console.log('');
    
    // Check if match should be in live matches query
    console.log('🔍 Live Matches Query Check:');
    const liveMatchesQuery = `
      SELECT external_id, status_id, minute
      FROM ts_matches
      WHERE status_id IN (2, 3, 4, 5, 7)
      ORDER BY match_time DESC
    `;
    
    const liveMatchesResult = await client.query(liveMatchesQuery);
    const isInLiveMatches = liveMatchesResult.rows.some(m => m.external_id === match.external_id);
    
    if (isInLiveMatches) {
      console.log(`   ✅ Match IS in live matches query (status ${match.status_id})`);
    } else {
      console.log(`   ❌ Match is NOT in live matches query`);
      console.log(`   → Reason: status_id = ${match.status_id} (not in [2, 3, 4, 5, 7])`);
      console.log(`   → Fix: Update status_id to ${providerStatusId || 2}`);
    }
    console.log('');
    
    // Solution
    if (providerStatusId !== match.status_id && [2, 3, 4, 5, 7].includes(providerStatusId)) {
      console.log('💡 Solution:');
      console.log(`   Run: node force-reconcile-match.js ${match.external_id}`);
      console.log(`   Or wait for ProactiveMatchStatusCheckWorker to detect and update`);
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

checkMatchNotLive().catch(console.error);

