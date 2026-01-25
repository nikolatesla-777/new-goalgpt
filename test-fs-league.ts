// Test FootyStats API response to see league field name
import { footyStatsAPI } from './src/services/footystats/footystats.client';

async function testLeagueField() {
  try {
    // Use the match ID from the recent publish (8437765)
    const matchId = 8437765;
    
    console.log(`Fetching match ${matchId}...`);
    const response = await footyStatsAPI.getMatchDetails(matchId);
    
    if (response.data) {
      console.log('\n=== LEAGUE/COMPETITION FIELDS ===');
      console.log('All keys:', Object.keys(response.data).sort());
      
      // Search for league-related fields
      const leagueFields = Object.keys(response.data).filter(k => 
        k.toLowerCase().includes('league') || 
        k.toLowerCase().includes('competition') ||
        k.toLowerCase().includes('tournament')
      );
      
      console.log('\nLeague-related fields:', leagueFields);
      
      leagueFields.forEach(field => {
        console.log(`  ${field}:`, (response.data as any)[field]);
      });
      
      console.log('\n=== SUGGESTED FIELD ===');
      if ((response.data as any).competition_name) {
        console.log('✅ competition_name:', (response.data as any).competition_name);
      } else if ((response.data as any).league_name) {
        console.log('✅ league_name:', (response.data as any).league_name);
      } else if ((response.data as any).competition) {
        console.log('✅ competition:', (response.data as any).competition);
      } else {
        console.log('❌ No league field found!');
      }
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

testLeagueField().then(() => process.exit(0));
