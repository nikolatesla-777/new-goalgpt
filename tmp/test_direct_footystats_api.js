// Test DIRECT FootyStats API call
require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.FOOTYSTATS_API_KEY;
const BASE_URL = 'https://api.football-data-api.com';

async function testDirectAPI() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  DIRECT FootyStats API Test');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Test 1: Today's matches
  console.log('1️⃣ Testing /todays-matches endpoint...');
  try {
    const url = `${BASE_URL}/todays-matches?key=${API_KEY}`;
    const response = await axios.get(url, { timeout: 10000 });
    
    console.log('✓ Success! Total matches:', response.data.data?.length || 0);
    
    // Show first 3 matches
    const matches = response.data.data || [];
    console.log('\nFirst 3 matches:');
    matches.slice(0, 3).forEach((m, i) => {
      console.log(`\n${i+1}. ID: ${m.id} - ${m.home_name} vs ${m.away_name}`);
      console.log(`   Status: ${m.status}`);
      console.log(`   Potentials: BTTS=${m.btts_potential || 'NULL'}, O2.5=${m.o25_potential || 'NULL'}`);
      console.log(`   xG: ${m.team_a_xg_prematch || 'NULL'} - ${m.team_b_xg_prematch || 'NULL'}`);
      console.log(`   Corners: ${m.corners_potential || 'NULL'}, Cards: ${m.cards_potential || 'NULL'}`);
    });
    
    // Save full response
    require('fs').writeFileSync('tmp/direct-api-today.json', JSON.stringify(response.data, null, 2));
    console.log('\n✓ Full response saved to tmp/direct-api-today.json');
    
  } catch (error) {
    console.log('✗ Error:', error.response?.data || error.message);
  }
  
  // Test 2: Single match details (Alavés vs Betis)
  console.log('\n\n2️⃣ Testing /match endpoint (match_id=8200594)...');
  try {
    const url = `${BASE_URL}/match?key=${API_KEY}&match_id=8200594`;
    const response = await axios.get(url, { timeout: 10000 });
    
    const match = response.data.data;
    console.log('✓ Success!');
    console.log(`\nMatch: ${match.home_name} vs ${match.away_name}`);
    console.log(`Status: ${match.status}`);
    console.log(`\nPotentials:`);
    console.log(`  BTTS: ${match.btts_potential || 'NULL'}`);
    console.log(`  O2.5: ${match.o25_potential || 'NULL'}`);
    console.log(`  Avg: ${match.avg_potential || 'NULL'}`);
    console.log(`  Corners: ${match.corners_potential || 'NULL'}`);
    console.log(`  Cards: ${match.cards_potential || 'NULL'}`);
    console.log(`\nH2H Available: ${!!match.h2h}`);
    console.log(`Trends Available: ${!!match.trends}`);
    
    // Save full response
    require('fs').writeFileSync('tmp/direct-api-match-8200594.json', JSON.stringify(response.data, null, 2));
    console.log('\n✓ Full response saved to tmp/direct-api-match-8200594.json');
    
  } catch (error) {
    console.log('✗ Error:', error.response?.data || error.message);
  }
  
  // Test 3: Different match (one with NULL potentials)
  console.log('\n\n3️⃣ Testing /match endpoint (match_id=8419232 - Gimnasia)...');
  try {
    const url = `${BASE_URL}/match?key=${API_KEY}&match_id=8419232`;
    const response = await axios.get(url, { timeout: 10000 });
    
    const match = response.data.data;
    console.log('✓ Success!');
    console.log(`\nMatch: ${match.home_name} vs ${match.away_name}`);
    console.log(`Status: ${match.status}`);
    console.log(`\nPotentials:`);
    console.log(`  BTTS: ${match.btts_potential || 'NULL'}`);
    console.log(`  O2.5: ${match.o25_potential || 'NULL'}`);
    console.log(`  Avg: ${match.avg_potential || 'NULL'}`);
    console.log(`  Corners: ${match.corners_potential || 'NULL'}`);
    console.log(`  Cards: ${match.cards_potential || 'NULL'}`);
    console.log(`\nH2H Available: ${!!match.h2h}`);
    console.log(`Trends Available: ${!!match.trends}`);
    
    // Save full response
    require('fs').writeFileSync('tmp/direct-api-match-8419232.json', JSON.stringify(response.data, null, 2));
    console.log('\n✓ Full response saved to tmp/direct-api-match-8419232.json');
    
  } catch (error) {
    console.log('✗ Error:', error.response?.data || error.message);
  }
}

testDirectAPI();
