/**
 * Test different date formats and dates with TheSports API
 */

import { TheSportsAPIManager } from './src/core/TheSportsAPIManager';
import { logger } from './src/utils/logger';

const api = TheSportsAPIManager.getInstance();

async function testDiaryDates() {
  console.log('🔍 Testing TheSports API /match/diary endpoint with different dates\n');

  // Test dates
  const datesToTest = [
    { label: 'Yesterday (19 Ocak)', date: '20260119' },
    { label: 'Today (20 Ocak)', date: '20260120' },
    { label: 'Tomorrow (21 Ocak)', date: '20260121' },
    { label: 'Last week (13 Ocak)', date: '20260113' },
  ];

  for (const { label, date } of datesToTest) {
    try {
      console.log(`📅 Testing ${label} (${date})...`);

      const response = await api.get<any>('/match/diary', {
        date,
        page: 1,
        limit: 10, // Small limit for testing
      });

      const total = response.total ?? 0;
      const resultsCount = response.results?.length ?? 0;

      console.log(`   ✅ Response: total=${total}, results=${resultsCount}`);

      if (resultsCount > 0) {
        const firstMatch = response.results[0];
        const matchTime = new Date(firstMatch.match_time * 1000);
        console.log(`   📊 First match: ID=${firstMatch.id}, Time=${matchTime.toISOString()}`);
      }

      if (response.err) {
        console.log(`   ⚠️ API Error: ${response.err}`);
      }

      console.log('');
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  // Also test recent endpoint
  console.log('🔍 Testing /match/recent/list endpoint (last 24h)...');
  try {
    const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    const response = await api.get<any>('/match/recent/list', {
      time: oneDayAgo,
      page: 1,
      limit: 10,
    });

    const total = response.total ?? 0;
    const resultsCount = response.results?.length ?? 0;

    console.log(`   ✅ Response: total=${total}, results=${resultsCount}`);

    if (resultsCount > 0) {
      const firstMatch = response.results[0];
      const matchTime = new Date(firstMatch.match_time * 1000);
      console.log(`   📊 First match: ID=${firstMatch.id}, Time=${matchTime.toISOString()}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

testDiaryDates().then(() => {
  console.log('\n✅ Tests complete');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
