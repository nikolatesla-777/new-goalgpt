/**
 * Check Ninh Binh match minute from database and provider
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

async function checkNinhBinhMinute() {
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
    console.log('\n🔍 Checking Ninh Binh U19 vs Hoai Duc U19 match...\n');
    
    // Find the match
    const dbResult = await client.query(
      `SELECT 
        m.external_id,
        m.status_id,
        m.minute,
        m.match_time,
        m.first_half_kickoff_ts,
        m.second_half_kickoff_ts,
        m.updated_at,
        ht.name as home_team,
        at.name as away_team
       FROM ts_matches m
       LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
       LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
       WHERE (
         LOWER(ht.name) LIKE '%ninh binh%' 
         OR LOWER(at.name) LIKE '%ninh binh%'
       )
       ORDER BY m.match_time DESC
       LIMIT 1`
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found in database');
      return;
    }
    
    const match = dbResult.rows[0];
    const now = Math.floor(Date.now() / 1000);
    
    console.log('📊 Database State:');
    console.log(`   Match ID: ${match.external_id}`);
    console.log(`   Teams: ${match.home_team || 'Unknown'} vs ${match.away_team || 'Unknown'}`);
    console.log(`   Status: ${match.status_id} (${getStatusName(match.status_id)})`);
    console.log(`   Minute (DB): ${match.minute !== null ? match.minute : 'NULL'}`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
    console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Updated At: ${new Date(match.updated_at).toISOString()}`);
    console.log('');
    
    // Calculate expected minute
    let calculatedMinute = null;
    if (match.status_id === 2 && match.first_half_kickoff_ts) {
      calculatedMinute = Math.floor((now - match.first_half_kickoff_ts) / 60) + 1;
      calculatedMinute = Math.min(calculatedMinute, 45);
      console.log('💡 Calculated Minute:');
      console.log(`   Status 2 (FIRST_HALF): ${calculatedMinute} minutes`);
      console.log(`   → First half started: ${new Date(match.first_half_kickoff_ts * 1000).toISOString()}`);
      console.log(`   → Elapsed: ${Math.floor((now - match.first_half_kickoff_ts) / 60)} minutes`);
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
    
    if (Array.isArray(providerMatch.score)) {
      providerStatusId = providerMatch.score[1];
    }
    
    providerMinute = providerMatch.minute || providerMatch.match_minute || null;
    
    console.log('📊 Provider State:');
    console.log(`   Status: ${providerStatusId} (${getStatusName(providerStatusId)})`);
    console.log(`   Minute (Provider): ${providerMinute !== null ? providerMinute : 'NULL'}`);
    console.log('');
    
    // Generate minute_text (same logic as backend)
    const minuteText = generateMinuteText(match.minute, match.status_id);
    
    console.log('🎯 Frontend Display:');
    console.log(`   Database Minute: ${match.minute !== null ? match.minute : 'NULL'}`);
    console.log(`   Status: ${match.status_id} (${getStatusName(match.status_id)})`);
    console.log(`   minute_text (Backend): "${minuteText}"`);
    console.log(`   → Frontend should display: "${minuteText}"`);
    console.log('');
    
    // Comparison
    if (match.minute === null) {
      console.log('❌ PROBLEM: Database minute is NULL!');
      console.log(`   → Frontend will show: "${minuteText}" (which is "—" if status is not special)`);
      console.log(`   → Fix: Reconcile match to set minute from kickoff timestamps`);
    } else {
      console.log(`✅ Database minute is set: ${match.minute}`);
      console.log(`   → Frontend will show: "${minuteText}"`);
      
      if (providerMinute !== null && Math.abs(match.minute - providerMinute) > 1) {
        console.log(`   ⚠️  WARNING: DB minute (${match.minute}) differs from provider minute (${providerMinute})`);
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

function generateMinuteText(minute, statusId) {
  if (statusId === 3) return 'HT';
  if (statusId === 8) return 'FT';
  if (statusId === 5) return 'ET';
  if (statusId === 7) return 'PEN';
  if (statusId === 9) return 'DELAY';
  if (statusId === 10) return 'INT';
  
  if (minute === null) {
    return '—';
  }
  
  if (statusId === 2 && minute > 45) return '45+';
  if (statusId === 4 && minute > 90) return '90+';
  
  return `${minute}'`;
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

checkNinhBinhMinute().catch(console.error);

