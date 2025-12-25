/**
 * Check live matches API response to see minute values
 */
const https = require('https');

const API_URL = process.env.VITE_API_URL || 'http://142.93.103.128:3000';

async function checkLiveMatches() {
  console.log(`\n🔍 Checking live matches from: ${API_URL}/api/matches/live\n`);
  
  const url = new URL('/api/matches/live', API_URL);
  
  https.get(url.toString(), (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        if (!response.success) {
          console.error('❌ API Error:', response.message);
          return;
        }
        
        const matches = response.data?.results || [];
        
        if (matches.length === 0) {
          console.log('ℹ️  No live matches found');
          return;
        }
        
        console.log(`📊 Found ${matches.length} live match(es):\n`);
        console.log('═'.repeat(120));
        console.log(
          'ID'.padEnd(15) +
          'Status'.padEnd(8) +
          'Minute'.padEnd(10) +
          'Minute Text'.padEnd(15) +
          'Score'.padEnd(12) +
          'Home Team'.padEnd(30) +
          'Away Team'.padEnd(30)
        );
        console.log('─'.repeat(120));
        
        for (const match of matches) {
          const id = (match.external_id || match.id || 'N/A').substring(0, 14);
          const status = match.status_id || match.status || '?';
          const minute = match.minute !== null && match.minute !== undefined ? match.minute : 'NULL';
          const minuteText = match.minute_text || 'NULL';
          const score = `${match.home_score_regular || 0} - ${match.away_score_regular || 0}`;
          const homeTeam = (match.home_team_name || 'Unknown').substring(0, 29);
          const awayTeam = (match.away_team_name || 'Unknown').substring(0, 29);
          
          console.log(
            id.padEnd(15) +
            String(status).padEnd(8) +
            String(minute).padEnd(10) +
            minuteText.padEnd(15) +
            score.padEnd(12) +
            homeTeam.padEnd(30) +
            awayTeam
          );
          
          // Show warning if minute is NULL
          if (match.minute === null || match.minute === undefined) {
            console.log(`  ⚠️  WARNING: Minute is NULL for match ${id}`);
            console.log(`      Status: ${status}, Minute Text: ${minuteText}`);
            console.log(`      This match needs kickoff timestamps to calculate minute`);
          }
        }
        
        console.log('\n' + '═'.repeat(120));
        console.log('💡 Tips:');
        console.log('   - If minute is NULL, run: node fix-all-missing-kickoff-timestamps.js');
        console.log('   - If minute_text is NULL, backend should generate it from minute');
        console.log('   - Frontend should display minute_text in the UI\n');
        
      } catch (error) {
        console.error('❌ Parse error:', error.message);
        console.error('Response:', data.substring(0, 500));
      }
    });
  }).on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });
}

checkLiveMatches();

