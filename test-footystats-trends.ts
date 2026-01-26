// Test script to see actual FootyStats trends format
import { footyStatsAPI } from './src/services/footystats/footystats.client';

async function testTrends() {
  try {
    // Eyüpspor vs Beşiktaş
    const matchId = 8231875;
    
    console.log(`Fetching match ${matchId}...`);
    const response = await footyStatsAPI.getMatchDetails(matchId);
    
    if (response.data && response.data.trends) {
      console.log('\n=== FOOTYSTATS TRENDS STRUCTURE ===');
      console.log('Type:', typeof response.data.trends);
      console.log('Has home?', !!response.data.trends.home);
      console.log('Has away?', !!response.data.trends.away);
      
      if (response.data.trends.home) {
        console.log('\n=== HOME TRENDS (count:', response.data.trends.home.length, ') ===');
        response.data.trends.home.forEach((trend: any, i: number) => {
          console.log(`\n[${i}]`);
          console.log('  sentiment:', trend.sentiment);
          console.log('  text:', trend.text);
          console.log('  text type:', typeof trend.text);
          console.log('  text lowercase:', trend.text?.toLowerCase());
        });
      }
      
      if (response.data.trends.away) {
        console.log('\n=== AWAY TRENDS (count:', response.data.trends.away.length, ') ===');
        response.data.trends.away.forEach((trend: any, i: number) => {
          console.log(`\n[${i}]`);
          console.log('  sentiment:', trend.sentiment);
          console.log('  text:', trend.text);
        });
      }
    } else {
      console.log('No trends data in response');
      console.log('Response keys:', Object.keys(response.data || {}));
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testTrends().then(() => process.exit(0));
