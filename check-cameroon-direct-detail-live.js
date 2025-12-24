/**
 * Direct check of detail_live for Cameroon match
 */
const https = require('https');
require('dotenv').config();

const user = process.env.THESPORTS_API_USER || '';
const secret = process.env.THESPORTS_API_SECRET || '';
const matchId = 'jw2r09hk9d3erz8'; // Cameroon match ID

async function checkDetailLive() {
  console.log(`🔍 Checking detail_live for match: ${matchId}\n`);
  
  const detailUrl = new URL('/v1/football/match/detail_live', 'https://api.thesports.com');
  detailUrl.searchParams.set('user', user);
  detailUrl.searchParams.set('secret', secret);
  detailUrl.searchParams.set('match_id', matchId);
  
  console.log(`URL: ${detailUrl.pathname}${detailUrl.search}\n`);
  
  const response = await makeRequest(detailUrl.pathname + detailUrl.search);
  
  if (response.err) {
    console.error('❌ Error:', response.err);
    return;
  }
  
  // Extract match from response
  let match = null;
  if (Array.isArray(response.results)) {
    match = response.results.find(m => String(m.id || m.match_id) === String(matchId));
  } else if (response.results && typeof response.results === 'object') {
    match = response.results;
  }
  
  if (!match) {
    console.log('❌ Match not found in detail_live response');
    console.log('Response structure:', JSON.stringify(response, null, 2).substring(0, 1000));
    return;
  }
  
  console.log('✅ Match found in detail_live\n');
  console.log('📊 Full match object:');
  console.log(JSON.stringify(match, null, 2));
  console.log('\n');
  
  // Parse score array
  if (Array.isArray(match.score)) {
    console.log('📊 Score array analysis:');
    console.log(`   Array length: ${match.score.length}`);
    console.log(`   [0] Match ID: ${match.score[0]}`);
    console.log(`   [1] Status ID: ${match.score[1]}`);
    console.log(`   [2] Home scores array:`, match.score[2]);
    console.log(`   [3] Away scores array:`, match.score[3]);
    console.log(`   [4] Kick-off timestamp: ${match.score[4]} (${new Date(match.score[4] * 1000).toISOString()})`);
    console.log(`   [5] Compatible ignore: ${match.score[5]}`);
    
    const statusId = match.score[1];
    const homeScore = Array.isArray(match.score[2]) ? match.score[2][0] : null;
    const awayScore = Array.isArray(match.score[3]) ? match.score[3][0] : null;
    const kickoffTs = match.score[4];
    
    console.log('\n📊 Extracted values:');
    console.log(`   Status ID: ${statusId}`);
    console.log(`   Home Score: ${homeScore}`);
    console.log(`   Away Score: ${awayScore}`);
    console.log(`   Kick-off timestamp: ${kickoffTs} (${new Date(kickoffTs * 1000).toISOString()})`);
  }
  
  // Check for minute field
  console.log('\n📊 Minute fields:');
  console.log(`   root.minute: ${match.minute}`);
  console.log(`   root.match_minute: ${match.match_minute}`);
  console.log(`   root.match?.minute: ${match.match?.minute}`);
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

checkDetailLive().catch(console.error);

