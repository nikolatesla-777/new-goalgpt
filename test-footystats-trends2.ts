// Test script to see actual FootyStats trends format - use today's matches
import { footyStatsAPI } from './src/services/footystats/footystats.client';

async function testTrends() {
  try {
    console.log('Fetching today matches...');
    const response = await footyStatsAPI.getTodaysMatches();
    
    if (!response.data || !response.data.length) {
      console.log('No matches found today');
      return;
    }
    
    // Get first match with trends
    const matchWithTrends = response.data.find((m: any) => m.trends && (m.trends.home?.length > 0 || m.trends.away?.length > 0));
    
    if (!matchWithTrends) {
      console.log('No matches with trends found');
      console.log('Total matches:', response.data.length);
      console.log('First match keys:', Object.keys(response.data[0] || {}));
      return;
    }
    
    console.log('\n=== MATCH INFO ===');
    console.log('ID:', matchWithTrends.id);
    console.log('Match:', matchWithTrends.home_name, 'vs', matchWithTrends.away_name);
    
    console.log('\n=== FOOTYSTATS TRENDS STRUCTURE ===');
    console.log('Type:', typeof matchWithTrends.trends);
    console.log('Has home?', !!matchWithTrends.trends.home);
    console.log('Has away?', !!matchWithTrends.trends.away);
    
    if (matchWithTrends.trends.home) {
      console.log('\n=== HOME TRENDS (count:', matchWithTrends.trends.home.length, ') ===');
      matchWithTrends.trends.home.slice(0, 3).forEach((trend: any, i: number) => {
        console.log(`\n[${i}]`);
        console.log('  sentiment:', trend.sentiment);
        console.log('  text:', trend.text);
        console.log('  text type:', typeof trend.text);
        if (trend.text) {
          console.log('  text lowercase:', trend.text.toLowerCase());
          console.log('  includes "won"?', trend.text.toLowerCase().includes('won'));
          console.log('  includes "last"?', trend.text.toLowerCase().includes('last'));
        }
      });
    }
    
    if (matchWithTrends.trends.away) {
      console.log('\n=== AWAY TRENDS (count:', matchWithTrends.trends.away.length, ') ===');
      matchWithTrends.trends.away.slice(0, 3).forEach((trend: any, i: number) => {
        console.log(`\n[${i}]`);
        console.log('  sentiment:', trend.sentiment);
        console.log('  text:', trend.text);
      });
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testTrends().then(() => process.exit(0));
