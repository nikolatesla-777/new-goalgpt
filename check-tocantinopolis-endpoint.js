/**
 * Check Tocantinopolis match via endpoint
 */

const https = require('https');

const matchId = 'k82rekhgxp2grep';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.thesports.com',
      port: 443,
      path: path,
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

async function checkMatch() {
  console.log(`\n🔍 Checking match ${matchId} via endpoints...\n`);
  
  try {
    // Check detail_live
    console.log('=== /match/detail_live ===');
    const detailLive = await makeRequest(`/v1/football/match/detail_live?match_id=${matchId}`);
    console.log('Status:', detailLive.status);
    if (detailLive.results && detailLive.results.length > 0) {
      const match = detailLive.results[0];
      console.log('Match found in detail_live:');
      console.log('  status_id:', match.status_id || match.status);
      console.log('  home_score:', match.home_score || match.home_scores?.[0]);
      console.log('  away_score:', match.away_score || match.away_scores?.[0]);
      console.log('  minute:', match.minute || match.match_minute);
      console.log('  update_time:', match.update_time);
      console.log('  Full match object:', JSON.stringify(match, null, 2));
    } else {
      console.log('❌ Match NOT found in detail_live response');
      console.log('Response:', JSON.stringify(detailLive, null, 2));
    }
  } catch (error) {
    console.error('❌ detail_live error:', error.message);
  }

  console.log('\n');

  try {
    // Check diary (today)
    const today = new Date();
    const dateStr = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(today.getUTCDate()).padStart(2, '0')}`;
    console.log(`=== /match/diary (date=${dateStr}) ===`);
    const diary = await makeRequest(`/v1/football/match/diary?date=${dateStr}`);
    console.log('Status:', diary.status);
    if (diary.results && diary.results.length > 0) {
      const match = diary.results.find(m => 
        String(m.id || m.match_id || m.external_id) === matchId
      );
      if (match) {
        console.log('Match found in diary:');
        console.log('  status_id:', match.status_id || match.status);
        console.log('  home_score:', match.home_score);
        console.log('  away_score:', match.away_score);
        console.log('  minute:', match.minute);
        console.log('  match_time:', match.match_time, new Date(match.match_time * 1000).toISOString());
        console.log('  Full match object:', JSON.stringify(match, null, 2));
      } else {
        console.log(`❌ Match ${matchId} NOT found in diary results (${diary.results.length} matches)`);
      }
    } else {
      console.log('❌ Diary response has no results');
      console.log('Response:', JSON.stringify(diary, null, 2));
    }
  } catch (error) {
    console.error('❌ diary error:', error.message);
  }

  console.log('\n');

  try {
    // Check recent list
    console.log('=== /match/recent/list ===');
    const recent = await makeRequest('/v1/football/match/recent/list');
    console.log('Status:', recent.status);
    if (recent.results && recent.results.length > 0) {
      const match = recent.results.find(m => 
        String(m.id || m.match_id || m.external_id) === matchId
      );
      if (match) {
        console.log('Match found in recent/list:');
        console.log('  status_id:', match.status_id || match.status);
        console.log('  home_score:', match.home_score || match.home_scores?.[0]);
        console.log('  away_score:', match.away_score || match.away_scores?.[0]);
        console.log('  minute:', match.minute || match.match_minute);
        console.log('  Full match object:', JSON.stringify(match, null, 2));
      } else {
        console.log(`❌ Match ${matchId} NOT found in recent/list (${recent.results.length} matches)`);
      }
    } else {
      console.log('❌ Recent/list response has no results');
    }
  } catch (error) {
    console.error('❌ recent/list error:', error.message);
  }
}

checkMatch().catch(console.error);

