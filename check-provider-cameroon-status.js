/**
 * Check provider status for Cameroon match
 */
const https = require('https');
require('dotenv').config();

const user = process.env.THESPORTS_API_USER || '';
const secret = process.env.THESPORTS_API_SECRET || '';

// Find Cameroon match ID from DB first, then check provider
async function checkProviderStatus() {
  console.log('\n🔍 Checking provider status for Cameroon match...\n');
  
  // First, get match ID from recent/list or diary
  const diaryUrl = new URL('/v1/football/match/diary', 'https://api.thesports.com');
  diaryUrl.searchParams.set('user', user);
  diaryUrl.searchParams.set('secret', secret);
  diaryUrl.searchParams.set('date', new Date().toISOString().split('T')[0]);
  
  console.log('Fetching today\'s matches from diary...');
  const diaryResponse = await makeRequest(diaryUrl.pathname + diaryUrl.search);
  
  if (diaryResponse.err) {
    console.error('Diary error:', diaryResponse.err);
    return;
  }
  
  // Find Cameroon match
  const matches = diaryResponse.results || [];
  const cameroonMatch = matches.find(m => {
    const homeName = (m.home_name || m.home_team_name || '').toLowerCase();
    const awayName = (m.away_name || m.away_team_name || '').toLowerCase();
    return homeName.includes('cameroon') || awayName.includes('cameroon') || 
           homeName.includes('gabon') || awayName.includes('gabon');
  });
  
  if (!cameroonMatch) {
    console.log('❌ Cameroon match not found in diary');
    return;
  }
  
  const matchId = cameroonMatch.id || cameroonMatch.match_id;
  console.log(`✅ Found match: ${cameroonMatch.home_name || '?'} vs ${cameroonMatch.away_name || '?'} (ID: ${matchId})`);
  console.log(`   Status: ${cameroonMatch.status_id || cameroonMatch.status || '?'}`);
  console.log(`   Score: ${cameroonMatch.home_score || 0}-${cameroonMatch.away_score || 0}`);
  
  // Now check detail_live
  console.log('\n🔍 Checking detail_live endpoint...');
  const detailUrl = new URL('/v1/football/match/detail_live', 'https://api.thesports.com');
  detailUrl.searchParams.set('user', user);
  detailUrl.searchParams.set('secret', secret);
  detailUrl.searchParams.set('match_id', matchId);
  
  const detailResponse = await makeRequest(detailUrl.pathname + detailUrl.search);
  
  if (detailResponse.err) {
    console.error('Detail live error:', detailResponse.err);
    return;
  }
  
  // Extract match from response
  let match = null;
  if (Array.isArray(detailResponse.results)) {
    match = detailResponse.results.find(m => String(m.id || m.match_id) === String(matchId));
  } else if (detailResponse.results && typeof detailResponse.results === 'object') {
    match = detailResponse.results;
  }
  
  if (!match) {
    console.log('❌ Match not found in detail_live response');
    return;
  }
  
  console.log('\n📊 Provider detail_live status:');
  console.log('   Status ID:', match.status_id || match.status || '?');
  
  // Check score array format
  if (Array.isArray(match.score)) {
    console.log('   Score array:', match.score);
    if (match.score.length >= 2) {
      console.log('   → Status from score[1]:', match.score[1]);
    }
    if (match.score.length >= 5 && typeof match.score[4] === 'number') {
      const kickoffTs = match.score[4];
      console.log('   → Kick-off timestamp:', kickoffTs, new Date(kickoffTs * 1000).toISOString());
    }
  }
  
  console.log('   Home score:', match.home_score || match.home_score_display || '?');
  console.log('   Away score:', match.away_score || match.away_score_display || '?');
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

checkProviderStatus().catch(console.error);
