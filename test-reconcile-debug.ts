import { TheSportsClient } from './src/services/thesports/client/thesports-client';

async function debugAPIResponse() {
  const matchId = '8yomo4h14eo4q0j';
  const apiClient = new TheSportsClient();
  
  const apiResponse = await apiClient.get('/match/detail_live', { match_id: matchId });
  
  console.log('📦 FULL API RESPONSE:');
  console.log(JSON.stringify(apiResponse, null, 2));
  console.log('\n');
  
  console.log('🔍 RESPONSE STRUCTURE:');
  console.log('Type:', typeof apiResponse);
  console.log('Keys:', Object.keys(apiResponse || {}));
  console.log('Code:', (apiResponse as any)?.code);
  console.log('Results type:', Array.isArray((apiResponse as any)?.results) ? 'array' : typeof (apiResponse as any)?.results);
  
  if (Array.isArray((apiResponse as any)?.results)) {
    console.log('Results length:', (apiResponse as any).results.length);
    (apiResponse as any).results.forEach((item: any, idx: number) => {
      console.log(`\nResult[${idx}]:`);
      console.log('  ID:', item?.id);
      console.log('  Has score:', !!item?.score);
      console.log('  Has status:', !!item?.status || !!item?.status_id);
      if (item?.id === matchId) {
        console.log('  ✅ MATCH FOUND IN RESULTS!');
      }
    });
  } else if ((apiResponse as any)?.results && typeof (apiResponse as any).results === 'object') {
    console.log('Results keys:', Object.keys((apiResponse as any).results));
  }
  
  // extractLiveFields mantığını simüle et
  console.log('\n🔍 EXTRACT LIVE FIELDS SIMULATION:');
  const root = (apiResponse as any)?.results ?? (apiResponse as any)?.result ?? (apiResponse as any)?.data ?? apiResponse;
  
  console.log('Root type:', Array.isArray(root) ? 'array' : typeof root);
  
  if (Array.isArray(root)) {
    const matchInArray = root.find((item: any) => item?.id === matchId);
    if (matchInArray) {
      console.log('✅ Match found in array');
      console.log('Match data:', JSON.stringify(matchInArray, null, 2));
    } else {
      console.log('❌ Match NOT found in array');
      console.log('Available IDs:', root.map((item: any) => item?.id).filter(Boolean));
    }
  } else {
    const statusId = root?.status_id ?? root?.status ?? root?.match?.status_id ?? root?.match?.status ?? null;
    const homeScore = root?.home_score ?? root?.home_score_display ?? root?.score?.home ?? null;
    const awayScore = root?.away_score ?? root?.away_score_display ?? root?.score?.away ?? null;
    
    console.log('Status ID:', statusId);
    console.log('Home Score:', homeScore);
    console.log('Away Score:', awayScore);
  }
}

debugAPIResponse().catch(console.error);





