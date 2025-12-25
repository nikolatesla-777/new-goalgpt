/**
 * Reconcile all live matches with NULL kickoff timestamps
 * This triggers reconcileMatchToDatabase which will set kickoff_ts and calculate minute
 */
const https = require('https');
const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

const API_URL = process.env.THESPORTS_API_URL || 'https://api.thesports.com';
const API_KEY = process.env.THESPORTS_API_KEY;

async function reconcileAllNullKickoffs() {
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
    console.log('\n🔍 Finding live matches with NULL kickoff timestamps...\n');
    
    // Find live matches with NULL kickoff timestamps
    const result = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts
       FROM ts_matches
       WHERE status_id IN (2, 3, 4, 5, 7)
       AND (first_half_kickoff_ts IS NULL OR (status_id = 4 AND second_half_kickoff_ts IS NULL))
       ORDER BY match_time DESC
       LIMIT 20`
    );
    
    if (result.rows.length === 0) {
      console.log('✅ No live matches with NULL kickoff timestamps found');
      return;
    }
    
    console.log(`📊 Found ${result.rows.length} matches to reconcile\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const match of result.rows) {
      const matchId = match.external_id;
      console.log(`🔄 Reconciling: ${matchId} (status: ${match.status_id})...`);
      
      try {
        // Call /match/detail_live endpoint
        const url = `${API_URL}/v1/football/match/detail_live?match_id=${matchId}`;
        const protocol = url.startsWith('https') ? https : http;
        
        const response = await new Promise((resolve, reject) => {
          const req = protocol.get(url, {
            headers: {
              'X-RapidAPI-Key': API_KEY,
              'X-RapidAPI-Host': 'api.thesports.com'
            }
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error(`Parse error: ${e.message}`));
              }
            });
          });
          req.on('error', reject);
          req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });
        });
        
        if (response.err) {
          console.log(`   ❌ API Error: ${response.err}`);
          errorCount++;
          continue;
        }
        
        // Check if match data exists
        if (!response.results || response.results.length === 0) {
          console.log(`   ⚠️  No match data in API response`);
          errorCount++;
          continue;
        }
        
        const matchData = response.results[0];
        const statusId = matchData.status_id || matchData.status;
        const score = matchData.score;
        
        // Extract kickoff time from score array
        let kickoffTime = null;
        if (Array.isArray(score) && score.length >= 5 && typeof score[4] === 'number') {
          kickoffTime = score[4];
        } else if (matchData.live_kickoff_time) {
          kickoffTime = matchData.live_kickoff_time;
        }
        
        console.log(`   📊 Provider: status=${statusId}, kickoff_ts=${kickoffTime || 'NULL'}`);
        
        // Update database directly (simulating reconcileMatchToDatabase)
        const now = Math.floor(Date.now() / 1000);
        const updateParts = [];
        const updateValues = [];
        let paramIndex = 1;
        
        // Set first_half_kickoff_ts if NULL and status is 2, 3, 4, 5, 7
        if ((statusId === 2 || statusId === 3 || statusId === 4 || statusId === 5 || statusId === 7) && match.first_half_kickoff_ts === null) {
          const finalKickoffTime = kickoffTime || match.match_time || now;
          updateParts.push(`first_half_kickoff_ts = $${paramIndex++}`);
          updateValues.push(finalKickoffTime);
          console.log(`   ✅ Will set first_half_kickoff_ts = ${finalKickoffTime}`);
        }
        
        // Set second_half_kickoff_ts if NULL and status is 4
        if (statusId === 4 && match.second_half_kickoff_ts === null) {
          const finalKickoffTime = kickoffTime || now;
          updateParts.push(`second_half_kickoff_ts = $${paramIndex++}`);
          updateValues.push(finalKickoffTime);
          console.log(`   ✅ Will set second_half_kickoff_ts = ${finalKickoffTime}`);
        }
        
        // Calculate minute if kickoff timestamps are available
        if (updateParts.length > 0) {
          updateParts.push(`updated_at = NOW()`);
          
          // Execute update
          const updateQuery = `UPDATE ts_matches SET ${updateParts.join(', ')} WHERE external_id = $${paramIndex}`;
          updateValues.push(matchId);
          
          await client.query(updateQuery, updateValues);
          
          // Now calculate minute
          const verifyResult = await client.query(
            `SELECT first_half_kickoff_ts, second_half_kickoff_ts, status_id FROM ts_matches WHERE external_id = $1`,
            [matchId]
          );
          
          const updated = verifyResult.rows[0];
          let calculatedMinute = null;
          
          if (statusId === 2 && updated.first_half_kickoff_ts) {
            calculatedMinute = Math.floor((now - updated.first_half_kickoff_ts) / 60) + 1;
            calculatedMinute = Math.min(calculatedMinute, 45);
          } else if (statusId === 4 && updated.second_half_kickoff_ts) {
            calculatedMinute = Math.floor((now - updated.second_half_kickoff_ts) / 60) + 1;
            calculatedMinute = Math.min(calculatedMinute, 90);
          }
          
          if (calculatedMinute !== null) {
            await client.query(
              `UPDATE ts_matches SET minute = $1 WHERE external_id = $2`,
              [calculatedMinute, matchId]
            );
            console.log(`   ✅ Set minute = ${calculatedMinute}`);
          }
          
          successCount++;
        } else {
          console.log(`   ⚠️  No kickoff timestamps to set`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
      
      console.log('');
    }
    
    console.log(`\n✅ Summary: ${successCount} reconciled, ${errorCount} errors`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

reconcileAllNullKickoffs().catch(console.error);

