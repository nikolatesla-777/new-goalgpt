/**
 * Force reconcile for Boliyohuto match to set kickoff timestamps and minute
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

const matchId = 'n54qllhnpk0gqvy'; // Boliyohuto vs Bongoayu

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
    // Check current state
    console.log(`\n🔍 Checking match: ${matchId}\n`);
    const dbResult = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        live_kickoff_time,
        provider_update_time
       FROM ts_matches 
       WHERE external_id = $1`,
      [matchId]
    );
    
    if (dbResult.rows.length === 0) {
      console.log('❌ Match not found in database');
      return;
    }
    
    const match = dbResult.rows[0];
    console.log('📊 Current Database State:');
    console.log(`   Status: ${match.status_id}`);
    console.log(`   Minute: ${match.minute}`);
    console.log(`   Match Time: ${new Date(match.match_time * 1000).toISOString()}`);
    console.log(`   First Half Kickoff: ${match.first_half_kickoff_ts ? new Date(match.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Second Half Kickoff: ${match.second_half_kickoff_ts ? new Date(match.second_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
    console.log(`   Live Kickoff Time: ${match.live_kickoff_time ? new Date(match.live_kickoff_time * 1000).toISOString() : 'NULL'}`);
    console.log('');
    
    // Get provider data
    console.log('📊 Fetching provider data...\n');
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
    
    // Parse provider data
    let providerStatusId = null;
    let providerMinute = null;
    let providerKickoffTs = null;
    
    if (Array.isArray(providerMatch.score)) {
      providerStatusId = providerMatch.score[1];
      providerKickoffTs = providerMatch.score[4]; // liveKickoffTime from score array
      console.log(`   Status ID (from score[1]): ${providerStatusId}`);
      console.log(`   Kickoff TS (from score[4]): ${providerKickoffTs} (${providerKickoffTs ? new Date(providerKickoffTs * 1000).toISOString() : 'N/A'})`);
    }
    
    providerMinute = providerMatch.minute ?? providerMatch.match_minute ?? providerMatch.match?.minute ?? null;
    console.log(`   Minute: ${providerMinute}`);
    console.log('');
    
    // Calculate what needs to be set
    const now = Math.floor(Date.now() / 1000);
    const updates = [];
    
    // If status is 4 (SECOND_HALF) and second_half_kickoff_ts is NULL
    if (match.status_id === 4 && match.second_half_kickoff_ts === null) {
      // Use provider kickoff if available, else estimate (match_time + 45 minutes + 15 minutes halftime)
      const estimatedSecondHalfKickoff = providerKickoffTs || (match.match_time + (45 * 60) + (15 * 60));
      updates.push({
        field: 'second_half_kickoff_ts',
        value: estimatedSecondHalfKickoff,
        reason: providerKickoffTs ? 'from provider score[4]' : 'estimated (match_time + 60min)'
      });
    }
    
    // If first_half_kickoff_ts is NULL and status is 2, 3, 4, 5, 7
    if ((match.status_id === 2 || match.status_id === 3 || match.status_id === 4 || match.status_id === 5 || match.status_id === 7) && match.first_half_kickoff_ts === null) {
      updates.push({
        field: 'first_half_kickoff_ts',
        value: match.match_time,
        reason: 'from match_time'
      });
    }
    
    // Calculate minute if needed
    let calculatedMinute = null;
    if (providerMinute !== null) {
      calculatedMinute = providerMinute;
    } else if (match.status_id === 4 && (updates.find(u => u.field === 'second_half_kickoff_ts') || match.second_half_kickoff_ts)) {
      const secondHalfKickoff = updates.find(u => u.field === 'second_half_kickoff_ts')?.value || match.second_half_kickoff_ts;
      calculatedMinute = 45 + Math.floor((now - secondHalfKickoff) / 60) + 1;
      calculatedMinute = Math.max(calculatedMinute, 46);
    } else if (match.status_id === 2 && (updates.find(u => u.field === 'first_half_kickoff_ts') || match.first_half_kickoff_ts)) {
      const firstHalfKickoff = updates.find(u => u.field === 'first_half_kickoff_ts')?.value || match.first_half_kickoff_ts;
      calculatedMinute = Math.floor((now - firstHalfKickoff) / 60) + 1;
      calculatedMinute = Math.min(calculatedMinute, 45);
    }
    
    if (calculatedMinute !== null && match.minute === null) {
      updates.push({
        field: 'minute',
        value: calculatedMinute,
        reason: 'calculated from kickoff timestamps'
      });
    }
    
    // Apply updates
    if (updates.length > 0) {
      console.log('📝 Applying updates:\n');
      const setParts = [];
      const values = [];
      let i = 1;
      
      for (const update of updates) {
        setParts.push(`${update.field} = $${i++}`);
        values.push(update.value);
        console.log(`   ${update.field} = ${update.value} (${new Date(update.value * 1000).toISOString()}) - ${update.reason}`);
      }
      
      setParts.push('updated_at = NOW()');
      
      values.push(matchId);
      const query = `UPDATE ts_matches SET ${setParts.join(', ')} WHERE external_id = $${i}`;
      
      console.log(`\n🔧 Executing: ${query.replace(/\$\d+/g, '?')}`);
      console.log(`   Values: ${values.slice(0, -1).map(v => typeof v === 'number' ? new Date(v * 1000).toISOString() : v).join(', ')}\n`);
      
      const updateResult = await client.query(query, values);
      
      if (updateResult.rowCount > 0) {
        console.log(`✅ Updated ${updateResult.rowCount} row(s)\n`);
        
        // Verify
        const verifyResult = await client.query(
          `SELECT minute, first_half_kickoff_ts, second_half_kickoff_ts FROM ts_matches WHERE external_id = $1`,
          [matchId]
        );
        const updated = verifyResult.rows[0];
        console.log('📊 Updated State:');
        console.log(`   Minute: ${updated.minute}`);
        console.log(`   First Half Kickoff: ${updated.first_half_kickoff_ts ? new Date(updated.first_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
        console.log(`   Second Half Kickoff: ${updated.second_half_kickoff_ts ? new Date(updated.second_half_kickoff_ts * 1000).toISOString() : 'NULL'}`);
      } else {
        console.log('⚠️  No rows updated');
      }
    } else {
      console.log('✅ No updates needed');
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

