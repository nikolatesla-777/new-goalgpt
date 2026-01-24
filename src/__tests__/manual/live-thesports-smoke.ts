/**
 * Live TheSports API Smoke Test
 *
 * REQUIRES: THESPORTS_API_USER and THESPORTS_API_SECRET in .env
 * REQUIRES: Network access to TheSports API
 *
 * This script makes REAL API calls to verify the hardened TheSportsClient
 * and migrated services work correctly with the actual API.
 *
 * Usage: npm run test:live-thesports
 */

import { MatchDiaryService } from '../../services/thesports/match/matchDiary.service';
import { CompetitionService } from '../../services/thesports/competition/competition.service';
import { theSportsAPIAdapter } from '../../integrations/thesports';
import { logger } from '../../utils/logger';

async function runLiveSmokeTest() {
  console.log('🚀 Starting Live TheSports API Smoke Test...\n');

  try {
    // 1. Check adapter health
    console.log('1️⃣ Checking TheSportsAPIAdapter health...');
    const health = theSportsAPIAdapter.getHealth();
    console.log('  ✅ Adapter initialized:', health.initialized);
    console.log('  ✅ Circuit state:', health.circuitState);
    console.log('  ✅ Rate limiter tokens:', health.rateLimiter.tokens);
    console.log('');

    // 2. Test MatchDiaryService with real API
    console.log('2️⃣ Testing MatchDiaryService.getMatchDiary() with real API...');
    const matchService = new MatchDiaryService();
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    console.log(`  📅 Fetching match diary for date: ${today}`);

    const startTime = Date.now();
    const diaryResponse = await matchService.getMatchDiary({ date: today });
    const duration = Date.now() - startTime;

    console.log(`  ⏱️  Response time: ${duration}ms`);
    console.log(`  ✅ Results count: ${diaryResponse.results?.length || 0}`);
    console.log(`  ✅ Has results_extra: ${!!diaryResponse.results_extra}`);

    if (diaryResponse.results && diaryResponse.results.length > 0) {
      const firstMatch = diaryResponse.results[0] as any;
      console.log(`  ✅ First match ID: ${firstMatch.id}`);
      console.log(`  ✅ First match teams: ${firstMatch.home_team_name} vs ${firstMatch.away_team_name}`);
    }
    console.log('');

    // 3. Test CompetitionService with real API
    console.log('3️⃣ Testing CompetitionService.getCompetitionList() with real API...');
    const compService = new CompetitionService();

    const compStartTime = Date.now();
    const compResponse = await compService.getCompetitionList();
    const compDuration = Date.now() - compStartTime;

    console.log(`  ⏱️  Response time: ${compDuration}ms`);
    console.log(`  ✅ Competitions count: ${compResponse.results?.length || 0}`);

    if (compResponse.results && compResponse.results.length > 0) {
      const firstComp = compResponse.results[0];
      console.log(`  ✅ First competition: ${firstComp.name} (ID: ${firstComp.id})`);
    }
    console.log('');

    // 4. Check final adapter health
    console.log('4️⃣ Final adapter health check...');
    const finalHealth = theSportsAPIAdapter.getHealth();
    console.log('  ✅ Circuit state:', finalHealth.circuitState);
    console.log('  ✅ Total requests:', finalHealth.metrics.requests);
    console.log('  ✅ Total errors:', finalHealth.metrics.errors);
    // @ts-expect-error - circuitOpenCount property may not exist on all metric implementations
    console.log('  ✅ Circuit open count:', finalHealth.metrics.circuitOpenCount);
    console.log('');

    // 5. Summary
    console.log('✅ All live smoke tests passed!');
    console.log('');
    console.log('Summary:');
    console.log(`  - Match diary response: ${diaryResponse.results?.length || 0} matches in ${duration}ms`);
    console.log(`  - Competition list response: ${compResponse.results?.length || 0} competitions in ${compDuration}ms`);
    console.log(`  - Circuit breaker: ${finalHealth.circuitState}`);
    console.log(`  - Error rate: ${finalHealth.metrics.errors}/${finalHealth.metrics.requests}`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Live smoke test failed:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);

    // Check if credentials are missing
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.error('');
      console.error('⚠️  Hint: Check THESPORTS_API_USER and THESPORTS_API_SECRET in .env');
    }

    process.exit(1);
  }
}

// Run the test
runLiveSmokeTest();
