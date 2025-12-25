/**
 * Force reconcile Ninh Binh match to set minute
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

async function forceReconcileNinhBinh() {
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
    console.log('\n🔄 Force reconciling Ninh Binh match...\n');
    
    // Find the match
    const dbResult = await client.query(
      `SELECT external_id, status_id, minute, match_time, first_half_kickoff_ts
       FROM ts_matches
       WHERE external_id = '318q66hx67dlqo9'`
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found');
      return;
    }
    
    const match = dbResult.rows[0];
    console.log('📊 Before:');
    console.log(`   Status: ${match.status_id}`);
    console.log(`   Minute: ${match.minute}`);
    console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
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
    let providerKickoffTs = null;
    
    if (Array.isArray(providerMatch.score)) {
      providerStatusId = providerMatch.score[1];
      providerKickoffTs = providerMatch.score[4];
    }
    
    providerMinute = providerMatch.minute || providerMatch.match_minute || null;
    
    console.log('📊 Provider State:');
    console.log(`   Status: ${providerStatusId}`);
    console.log(`   Minute: ${providerMinute !== null ? providerMinute : 'NULL'}`);
    console.log(`   Kickoff TS: ${providerKickoffTs ? new Date(providerKickoffTs * 1000).toISOString() : 'NULL'}`);
    console.log('');
    
    // Calculate minute if needed
    const now = Math.floor(Date.now() / 1000);
    let calculatedMinute = null;
    let firstHalfKickoffToSet = match.first_half_kickoff_ts;
    
    // Set first_half_kickoff_ts if NULL
    if ((providerStatusId === 2 || providerStatusId === 3 || providerStatusId === 4) && match.first_half_kickoff_ts === null) {
      firstHalfKickoffToSet = providerKickoffTs && providerKickoffTs > 0 ? providerKickoffTs : match.match_time;
      console.log(`💡 Setting first_half_kickoff_ts: ${new Date(firstHalfKickoffToSet * 1000).toISOString()}`);
    }
    
    // Calculate minute
    if (providerStatusId === 2 && firstHalfKickoffToSet) {
      calculatedMinute = Math.floor((now - firstHalfKickoffToSet) / 60) + 1;
      calculatedMinute = Math.min(calculatedMinute, 45);
      console.log(`💡 Calculated minute: ${calculatedMinute} (from first_half_kickoff_ts)`);
    } else if (providerStatusId === 3) {
      calculatedMinute = 45;
      console.log(`💡 Calculated minute: 45 (HALF_TIME)`);
    }
    
    // Update database
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (providerStatusId !== match.status_id) {
      updates.push(`status_id = $${paramIndex++}`);
      values.push(providerStatusId);
    }
    
    if (match.first_half_kickoff_ts === null && firstHalfKickoffToSet) {
      updates.push(`first_half_kickoff_ts = $${paramIndex++}`);
      values.push(firstHalfKickoffToSet);
    }
    
    if (calculatedMinute !== null && match.minute !== calculatedMinute) {
      updates.push(`minute = $${paramIndex++}`);
      values.push(calculatedMinute);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(match.external_id);
      
      const query = `UPDATE ts_matches SET ${updates.join(', ')} WHERE external_id = $${paramIndex}`;
      
      await client.query(query, values);
      
      console.log('✅ Updated:');
      if (updates.some(u => u.includes('status_id'))) console.log(`   Status: ${match.status_id} → ${providerStatusId}`);
      if (updates.some(u => u.includes('first_half_kickoff_ts'))) console.log(`   First Half Kickoff: Set`);
      if (updates.some(u => u.includes('minute'))) console.log(`   Minute: ${match.minute} → ${calculatedMinute}`);
      console.log('');
      
      // Verify
      const verifyResult = await client.query(
        `SELECT status_id, minute, first_half_kickoff_ts FROM ts_matches WHERE external_id = $1`,
        [match.external_id]
      );
      
      const updated = verifyResult.rows[0];
      console.log('📊 After:');
      console.log(`   Status: ${updated.status_id}`);
      console.log(`   Minute: ${updated.minute}`);
      console.log(`   First Half Kickoff: ${updated.first_half_kickoff_ts ? new Date(updated.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
      console.log('');
      
      // Generate minute_text
      const minuteText = generateMinuteText(updated.minute, updated.status_id);
      console.log('🎯 Frontend Display:');
      console.log(`   minute_text: "${minuteText}"`);
      console.log(`   → Frontend should now show: "${minuteText}"`);
    } else {
      console.log('ℹ️  No updates needed');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
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

forceReconcileNinhBinh().catch(console.error);

