/**
 * Fix all matches with NULL kickoff timestamps by calling reconcileMatchToDatabase
 * This ensures minute can be calculated for all live matches
 */
const { Pool } = require('pg');
const https = require('https');
require('dotenv').config();

// Import the service (we'll need to use TypeScript compilation or create a JS version)
// For now, we'll directly call the provider API and update database

async function fixAllMissingKickoffTimestamps() {
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
    console.log('\n🔍 Finding matches with NULL kickoff timestamps or NULL minute...\n');
    
    // Find all live matches (status 2, 3, 4, 5, 7) with NULL kickoff timestamps OR NULL minute
    const result = await client.query(
      `SELECT 
        external_id,
        status_id,
        minute,
        match_time,
        first_half_kickoff_ts,
        second_half_kickoff_ts,
        overtime_kickoff_ts,
        live_kickoff_time,
        provider_update_time
       FROM ts_matches
       WHERE status_id IN (2, 3, 4, 5, 7)
         AND (
           (status_id IN (2, 3, 4, 5, 7) AND first_half_kickoff_ts IS NULL)
           OR (status_id IN (4, 5, 7) AND second_half_kickoff_ts IS NULL)
           OR (status_id = 5 AND overtime_kickoff_ts IS NULL)
           OR (minute IS NULL AND (
             (status_id = 2 AND first_half_kickoff_ts IS NOT NULL)
             OR (status_id = 3)
             OR (status_id = 4 AND second_half_kickoff_ts IS NOT NULL)
             OR (status_id = 5 AND overtime_kickoff_ts IS NOT NULL)
           ))
         )
       ORDER BY match_time DESC
       LIMIT 500`
    );
    
    if (result.rows.length === 0) {
      console.log('✅ No matches found with NULL kickoff timestamps or NULL minute');
      return;
    }
    
    console.log(`📊 Found ${result.rows.length} match(es) with NULL kickoff timestamps or NULL minute\n`);
    
    const user = process.env.THESPORTS_API_USER || '';
    const secret = process.env.THESPORTS_API_SECRET || '';
    
    let fixed = 0;
    let errors = 0;
    let skipped = 0;
    
    for (let i = 0; i < result.rows.length; i++) {
      const match = result.rows[i];
      const matchId = match.external_id;
      
      console.log(`[${i + 1}/${result.rows.length}] Processing: ${matchId.substring(0, 12)}... (status: ${match.status_id})`);
      
      try {
        // Get provider data
        const detailUrl = new URL('/v1/football/match/detail_live', 'https://api.thesports.com');
        detailUrl.searchParams.set('user', user);
        detailUrl.searchParams.set('secret', secret);
        detailUrl.searchParams.set('match_id', matchId);
        
        const providerResponse = await makeRequest(detailUrl.pathname + detailUrl.search);
        
        if (providerResponse.err) {
          console.log(`  ❌ Provider API Error: ${providerResponse.err}`);
          errors++;
          continue;
        }
        
        // Extract match from response
        let providerMatch = null;
        if (Array.isArray(providerResponse.results)) {
          providerMatch = providerResponse.results.find(m => String(m.id || m.match_id) === String(matchId));
        } else if (providerResponse.results && typeof providerResponse.results === 'object') {
          providerMatch = providerResponse.results;
        }
        
        if (!providerMatch) {
          console.log(`  ⚠️  Match not found in provider response (may be finished)`);
          skipped++;
          continue;
        }
        
        // Parse provider data
        let providerStatusId = null;
        let providerKickoffTs = null;
        
        if (Array.isArray(providerMatch.score)) {
          providerStatusId = providerMatch.score[1];
          providerKickoffTs = providerMatch.score[4]; // liveKickoffTime
        }
        
        // Check if status matches
        // If provider says END (8) but DB says live (2,3,4,5,7), update status to END
        if (providerStatusId === 8 && [2, 3, 4, 5, 7].includes(match.status_id)) {
          console.log(`  ⚠️  Status mismatch: DB=${match.status_id}, Provider=${providerStatusId} (updating to END)`);
          // Update status to END
          await client.query(
            `UPDATE ts_matches 
             SET status_id = 8, updated_at = NOW() 
             WHERE external_id = $1`,
            [matchId]
          );
          console.log(`  ✅ Updated status to END`);
          fixed++;
          skipped++;
          continue; // Skip kickoff timestamp updates for END matches
        } else if (providerStatusId !== match.status_id && providerStatusId !== null) {
          console.log(`  ⚠️  Status mismatch: DB=${match.status_id}, Provider=${providerStatusId} (skipping)`);
          skipped++;
          continue;
        }
        
        // Build updates
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        // Set first_half_kickoff_ts if NULL and status requires it
        if ((match.status_id === 2 || match.status_id === 3 || match.status_id === 4 || match.status_id === 5 || match.status_id === 7) && match.first_half_kickoff_ts === null) {
          updates.push(`first_half_kickoff_ts = $${paramIndex++}`);
          values.push(match.match_time); // Use match_time as fallback
        }
        
        // Set second_half_kickoff_ts if NULL and status requires it
        if ((match.status_id === 4 || match.status_id === 5 || match.status_id === 7) && match.second_half_kickoff_ts === null) {
          if (providerKickoffTs && providerKickoffTs > 0) {
            secondHalfKickoffValue = providerKickoffTs;
            updates.push(`second_half_kickoff_ts = $${paramIndex++}`);
            values.push(providerKickoffTs);
          } else {
            // Estimate: match_time + 60 minutes (45 min first half + 15 min halftime)
            secondHalfKickoffValue = match.match_time + (60 * 60);
            updates.push(`second_half_kickoff_ts = $${paramIndex++}`);
            values.push(secondHalfKickoffValue);
          }
        } else if (match.second_half_kickoff_ts) {
          secondHalfKickoffValue = match.second_half_kickoff_ts;
        }
        
        // Set overtime_kickoff_ts if NULL and status requires it
        if (match.status_id === 5 && match.overtime_kickoff_ts === null) {
          if (providerKickoffTs && providerKickoffTs > 0) {
            updates.push(`overtime_kickoff_ts = $${paramIndex++}`);
            values.push(providerKickoffTs);
          } else {
            // Estimate: match_time + 105 minutes (90 min + 15 min halftime)
            const estimated = match.match_time + (105 * 60);
            updates.push(`overtime_kickoff_ts = $${paramIndex++}`);
            values.push(estimated);
          }
        }
        
        // Calculate minute if needed
        let calculatedMinute = null;
        const now = Math.floor(Date.now() / 1000);
        
        if (match.status_id === 2 && (updates.some(u => u.includes('first_half_kickoff_ts')) || match.first_half_kickoff_ts)) {
          const firstHalfKickoff = updates.some(u => u.includes('first_half_kickoff_ts')) 
            ? match.match_time 
            : match.first_half_kickoff_ts;
          calculatedMinute = Math.floor((now - firstHalfKickoff) / 60) + 1;
          calculatedMinute = Math.min(calculatedMinute, 45);
        } else if (match.status_id === 3) {
          calculatedMinute = 45; // Half-time
        } else if (match.status_id === 4 && secondHalfKickoffValue) {
          calculatedMinute = 45 + Math.floor((now - secondHalfKickoffValue) / 60) + 1;
          calculatedMinute = Math.max(calculatedMinute, 46);
        } else if (match.status_id === 5 && (updates.some(u => u.includes('overtime_kickoff_ts')) || match.overtime_kickoff_ts)) {
          const overtimeKickoff = updates.some(u => u.includes('overtime_kickoff_ts'))
            ? (providerKickoffTs || (match.match_time + (105 * 60)))
            : match.overtime_kickoff_ts;
          calculatedMinute = 90 + Math.floor((now - overtimeKickoff) / 60) + 1;
        }
        
        if (calculatedMinute !== null && match.minute === null) {
          updates.push(`minute = $${paramIndex++}`);
          values.push(calculatedMinute);
        }
        
        // Apply updates
        if (updates.length > 0) {
          updates.push('updated_at = NOW()');
          values.push(matchId);
          
          const query = `UPDATE ts_matches SET ${updates.join(', ')} WHERE external_id = $${paramIndex}`;
          
          await client.query(query, values);
          
          const updateSummary = [];
          if (updates.some(u => u.includes('first_half_kickoff_ts'))) updateSummary.push('first_half_kickoff_ts');
          if (updates.some(u => u.includes('second_half_kickoff_ts'))) updateSummary.push('second_half_kickoff_ts');
          if (updates.some(u => u.includes('overtime_kickoff_ts'))) updateSummary.push('overtime_kickoff_ts');
          if (updates.some(u => u.includes('minute'))) updateSummary.push(`minute=${calculatedMinute}`);
          
          console.log(`  ✅ Fixed: ${updateSummary.join(', ')}`);
          fixed++;
        } else {
          console.log(`  ℹ️  No updates needed`);
          skipped++;
        }
        
        // Rate limiting: wait 200ms between API calls
        if (i < result.rows.length - 1) {
          await sleep(200);
        }
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⚠️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📈 Total: ${result.rows.length}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (client) {
      client.release();
    }
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

fixAllMissingKickoffTimestamps().catch(console.error);

