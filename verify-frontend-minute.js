/**
 * Verify that frontend will receive correct minute_text from backend API
 */
const http = require('http');
const https = require('https');

const API_URL = process.env.API_URL || 'http://142.93.103.128:3000';

async function verifyFrontendMinute() {
  try {
    console.log('\n🔍 Checking backend API for Ninh Binh match...\n');
    
    const url = `${API_URL}/api/matches/live`;
    const protocol = url.startsWith('https') ? https : http;
    
    const response = await new Promise((resolve, reject) => {
      protocol.get(url, (res) => {
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
      }).on('error', reject);
    });
    
    if (!response.success || !response.data || !response.data.results) {
      console.log('❌ API Error:', response);
      return;
    }
    
    const matches = response.data.results || [];
    console.log(`📊 Found ${matches.length} live match(es)\n`);
    
    // Find Ninh Binh match
    const ninhBinhMatch = matches.find(m => 
      (m.home_team_name && m.home_team_name.toLowerCase().includes('ninh binh')) ||
      (m.away_team_name && m.away_team_name.toLowerCase().includes('ninh binh')) ||
      (m.home_team && m.home_team.toLowerCase().includes('ninh binh')) ||
      (m.away_team && m.away_team.toLowerCase().includes('ninh binh'))
    );
    
    if (!ninhBinhMatch) {
      console.log('❌ Ninh Binh match not found in live matches');
      console.log('   Available matches:');
      matches.forEach(m => {
        const home = m.home_team_name || m.home_team || 'Unknown';
        const away = m.away_team_name || m.away_team || 'Unknown';
        console.log(`   - ${home} vs ${away} (status: ${m.status_id || m.status})`);
      });
      return;
    }
    
    console.log('✅ Ninh Binh match found!\n');
    console.log('📊 Backend API Response:');
    console.log(`   Match ID: ${ninhBinhMatch.external_id || ninhBinhMatch.id || ninhBinhMatch.match_id}`);
    console.log(`   Teams: ${ninhBinhMatch.home_team_name || ninhBinhMatch.home_team} vs ${ninhBinhMatch.away_team_name || ninhBinhMatch.away_team}`);
    console.log(`   Status: ${ninhBinhMatch.status_id || ninhBinhMatch.status}`);
    console.log(`   Minute: ${ninhBinhMatch.minute !== null && ninhBinhMatch.minute !== undefined ? ninhBinhMatch.minute : 'NULL'}`);
    console.log(`   minute_text: "${ninhBinhMatch.minute_text || 'NULL'}"`);
    console.log(`   Score: ${ninhBinhMatch.home_score_regular || 0} - ${ninhBinhMatch.away_score_regular || 0}`);
    console.log('');
    
    // Verify
    if (ninhBinhMatch.minute !== null && ninhBinhMatch.minute !== undefined) {
      console.log('✅ PROOF - Minute is set in backend:');
      console.log(`   Database minute: ${ninhBinhMatch.minute}`);
      console.log(`   Backend minute_text: "${ninhBinhMatch.minute_text}"`);
      console.log(`   → Frontend will display: "${ninhBinhMatch.minute_text}"`);
      console.log('');
      console.log('🎯 Frontend should show:');
      console.log(`   - Real minute: "${ninhBinhMatch.minute_text}" (not "11:00" or "—")`);
      console.log(`   - Status: "1. Yarı" (First Half)`);
    } else {
      console.log('❌ PROBLEM: Minute is still NULL in backend API response!');
      console.log(`   → Frontend will show: "${ninhBinhMatch.minute_text || '—'}"`);
      console.log(`   → Fix: Reconcile match again or check MatchSyncWorker`);
    }
    
    // Check all live matches
    console.log('\n📊 All Live Matches:');
    matches.forEach((m, index) => {
      const home = m.home_team_name || m.home_team || 'Unknown';
      const away = m.away_team_name || m.away_team || 'Unknown';
      const minute = m.minute !== null && m.minute !== undefined ? m.minute : 'NULL';
      const minuteText = m.minute_text || 'NULL';
      console.log(`   ${index + 1}. ${home} vs ${away}`);
      console.log(`      Status: ${m.status_id || m.status}, Minute: ${minute}, minute_text: "${minuteText}"`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
}

verifyFrontendMinute().catch(console.error);

