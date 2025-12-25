/**
 * Check match status from provider and compare with database
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

const matchId = process.argv[2] || 'vjxm8ghe5205r6o'; // Default: Vietnam U19 match

async function checkMatchStatus() {
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
    console.log(`\n🔍 Checking match: ${matchId}\n`);
    
    // Get database state
    const dbResult = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        updated_at
       FROM ts_matches
       WHERE external_id = $1 OR external_id LIKE $2`,
      [matchId, `${matchId}%`]
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found in database');
      return;
    }
    
    const match = dbResult.rows[0];
    console.log('📊 Database State:');
    console.log(`   External ID: ${match.external_id}`);
    console.log(`   Status: ${match.status_id} (${getStatusName(match.status_id)})`);
    console.log(`   Minute: ${match.minute}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
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
      console.log(`   Response keys: ${Object.keys(providerResponse).join(', ')}`);
      if (Array.isArray(providerResponse.results)) {
        console.log(`   Total results: ${providerResponse.results.length}`);
      }
      return;
    }
    
    // Parse provider status
    let providerStatusId = null;
    let providerMinute = null;
    
    if (Array.isArray(providerMatch.score)) {
      providerStatusId = providerMatch.score[1];
      providerMinute = providerMatch.minute || providerMatch.match_minute || null;
    } else if (providerMatch.status_id !== undefined) {
      providerStatusId = providerMatch.status_id;
      providerMinute = providerMatch.minute || providerMatch.match_minute || null;
    }
    
    console.log('📊 Provider State:');
    console.log(`   Status: ${providerStatusId} (${getStatusName(providerStatusId)})`);
    console.log(`   Minute: ${providerMinute}`);
    console.log(`   Score Array: ${JSON.stringify(providerMatch.score)}`);
    console.log('');
    
    // Compare
    console.log('🔍 Comparison:');
    if (providerStatusId === match.status_id) {
      console.log(`   ✅ Status matches: ${match.status_id}`);
    } else {
      console.log(`   ❌ Status MISMATCH:`);
      console.log(`      DB: ${match.status_id} (${getStatusName(match.status_id)})`);
      console.log(`      Provider: ${providerStatusId} (${getStatusName(providerStatusId)})`);
      
      if (providerStatusId === 8 && [2, 3, 4, 5, 7].includes(match.status_id)) {
        console.log(`   🚨 CRITICAL: Provider says END but DB says LIVE!`);
        console.log(`   → This match should be updated to END status`);
      }
    }
    
    if (providerMinute !== null && match.minute !== providerMinute) {
      console.log(`   ⚠️  Minute mismatch: DB=${match.minute}, Provider=${providerMinute}`);
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

checkMatchStatus().catch(console.error);

