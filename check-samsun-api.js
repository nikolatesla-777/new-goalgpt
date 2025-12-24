/**
 * Check Samsunspor match via API
 */

async function checkSamsunMatch() {
  try {
    // Check live matches
    console.log('\n🔍 Checking /api/matches/live...');
    const liveRes = await fetch('http://localhost:3000/api/matches/live');
    const liveData = await liveRes.json();
    const liveMatches = liveData?.data?.results || liveData?.results || [];
    
    const samsunLive = liveMatches.filter(m => {
      const home = (m.home_team_name || '').toLowerCase();
      const away = (m.away_team_name || '').toLowerCase();
      return home.includes('samsun') || away.includes('samsun') || home.includes('eyüp') || away.includes('eyüp');
    });
    
    console.log(`   Total live matches: ${liveMatches.length}`);
    console.log(`   Samsunspor matches in live: ${samsunLive.length}`);
    if (samsunLive.length > 0) {
      samsunLive.forEach(m => {
        console.log(`   ✅ ${m.home_team_name} vs ${m.away_team_name} - Status: ${m.status_id} - Score: ${m.home_score || 0}-${m.away_score || 0} - Minute: ${m.minute || 'N/A'}`);
      });
    }
    
    // Check should-be-live
    console.log('\n🔍 Checking /api/matches/should-be-live...');
    const shouldRes = await fetch('http://localhost:3000/api/matches/should-be-live?limit=100');
    const shouldData = await shouldRes.json();
    const shouldMatches = shouldData?.data?.results || shouldData?.results || [];
    
    const samsunShould = shouldMatches.filter(m => {
      const home = (m.home_team_name || '').toLowerCase();
      const away = (m.away_team_name || '').toLowerCase();
      return home.includes('samsun') || away.includes('samsun') || home.includes('eyüp') || away.includes('eyüp');
    });
    
    console.log(`   Total should-be-live matches: ${shouldMatches.length}`);
    console.log(`   Samsunspor matches in should-be-live: ${samsunShould.length}`);
    if (samsunShould.length > 0) {
      samsunShould.forEach(m => {
        const matchTime = new Date(m.match_time * 1000).toLocaleString('tr-TR');
        console.log(`   ⚠️  ${m.home_team_name} vs ${m.away_team_name} - Status: ${m.status_id} (NOT_STARTED) - Match Time: ${matchTime}`);
      });
    }
    
    // Check diary (today's matches)
    console.log('\n🔍 Checking /api/matches/diary...');
    const diaryRes = await fetch('http://localhost:3000/api/matches/diary');
    const diaryData = await diaryRes.json();
    const diaryMatches = diaryData?.data?.results || diaryData?.results || [];
    
    const samsunDiary = diaryMatches.filter(m => {
      const home = (m.home_team_name || '').toLowerCase();
      const away = (m.away_team_name || '').toLowerCase();
      return home.includes('samsun') || away.includes('samsun') || home.includes('eyüp') || away.includes('eyüp');
    });
    
    console.log(`   Total today matches: ${diaryMatches.length}`);
    console.log(`   Samsunspor matches today: ${samsunDiary.length}`);
    if (samsunDiary.length > 0) {
      samsunDiary.forEach(m => {
        const matchTime = new Date(m.match_time * 1000).toLocaleString('tr-TR');
        console.log(`   📅 ${m.home_team_name} vs ${m.away_team_name} - Status: ${m.status_id} - Score: ${m.home_score || 0}-${m.away_score || 0} - Match Time: ${matchTime}`);
      });
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSamsunMatch();


