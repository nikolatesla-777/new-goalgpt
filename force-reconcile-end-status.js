/**
 * Force reconcile a match to END status if provider says END
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

const matchId = process.argv[2] || 'vjxm8ghe5205r6o';

async function forceReconcile() {
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
    console.log(`\n🔍 Force reconciling match: ${matchId}\n`);
    
    // Get current DB state
    const dbResult = await client.query(
      `SELECT external_id, status_id, minute, provider_update_time, last_event_ts
       FROM ts_matches
       WHERE external_id = $1 OR external_id LIKE $2`,
      [matchId, `${matchId}%`]
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found in database');
      return;
    }
    
    const match = dbResult.rows[0];
    console.log('📊 Current DB State:');
    console.log(`   External ID: ${match.external_id}`);
    console.log(`   Status: ${match.status_id}`);
    console.log(`   Provider Update Time: ${match.provider_update_time}`);
    console.log(`   Last Event TS: ${match.last_event_ts}`);
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
    
    // Parse provider status
    let providerStatusId = null;
    let providerHomeScore = null;
    let providerAwayScore = null;
    
    if (Array.isArray(providerMatch.score)) {
      providerStatusId = providerMatch.score[1];
      providerHomeScore = Array.isArray(providerMatch.score[2]) ? providerMatch.score[2][0] : null;
      providerAwayScore = Array.isArray(providerMatch.score[3]) ? providerMatch.score[3][0] : null;
    }
    
    console.log('📊 Provider State:');
    console.log(`   Status: ${providerStatusId}`);
    console.log(`   Score: ${providerHomeScore} - ${providerAwayScore}`);
    console.log('');
    
    // Check if update needed
    if (providerStatusId === 8 && [2, 3, 4, 5, 7].includes(match.status_id)) {
      console.log('🚨 CRITICAL: Provider says END but DB says LIVE!');
      console.log('   Updating to END status...\n');
      
      const now = Math.floor(Date.now() / 1000);
      const updateResult = await client.query(
        `UPDATE ts_matches 
         SET status_id = 8,
             home_score_regular = COALESCE($1, home_score_regular),
             away_score_regular = COALESCE($2, away_score_regular),
             home_score_display = COALESCE($1, home_score_display),
             away_score_display = COALESCE($2, away_score_display),
             provider_update_time = GREATEST(COALESCE(provider_update_time, 0)::BIGINT, $3::BIGINT),
             last_event_ts = $4::BIGINT,
             updated_at = NOW()
         WHERE external_id = $5`,
        [providerHomeScore, providerAwayScore, now, now, match.external_id]
      );
      
      if (updateResult.rowCount > 0) {
        console.log('✅ Successfully updated match to END status');
        console.log(`   Rows updated: ${updateResult.rowCount}`);
      } else {
        console.log('⚠️  No rows updated (maybe already END?)');
      }
    } else if (providerStatusId === match.status_id) {
      console.log('✅ Status already matches (no update needed)');
    } else {
      console.log(`⚠️  Status mismatch but not END transition: DB=${match.status_id}, Provider=${providerStatusId}`);
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

forceReconcile().catch(console.error);

