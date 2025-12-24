/**
 * Phase 3B - Madde 5: Watchdog Deterministic Test
 * 
 * Tests ONLY the selection logic of findStaleLiveMatches().
 * Does NOT call reconcile.
 */

import { MatchWatchdogService } from '../services/thesports/match/matchWatchdog.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function testWatchdogSelection() {
  console.log('\n🧪 TEST: Watchdog Selection Logic');
  console.log('='.repeat(70));

  const service = new MatchWatchdogService();
  const nowTs = Math.floor(Date.now() / 1000);
  const client = await pool.connect();

  try {
    // Cleanup test matches
    await client.query(`DELETE FROM ts_matches WHERE external_id LIKE 'phase3b_test_watchdog_%'`);

    // 1. Insert stale live match (status 2, stale timestamps)
    const staleMatchId = 'phase3b_test_watchdog_stale_1';
    await client.query(
      `INSERT INTO ts_matches (
        external_id, status_id, match_time, 
        last_event_ts, provider_update_time, updated_at
      ) VALUES (
        $1, 2, $2::BIGINT,
        $3::BIGINT, $4::BIGINT, NOW() - INTERVAL '1000 seconds'
      )`,
      [staleMatchId, nowTs - 3600, nowTs - 1000, nowTs - 1000]
    );
    console.log(`✅ Created stale match: ${staleMatchId} (status=2, last_event_ts=${nowTs - 1000}, stale)`);

    // 2. Insert fresh live match (status 2, fresh timestamps)
    const freshMatchId = 'phase3b_test_watchdog_fresh_1';
    await client.query(
      `INSERT INTO ts_matches (
        external_id, status_id, match_time,
        last_event_ts, provider_update_time, updated_at
      ) VALUES (
        $1, 2, $2::BIGINT,
        $3::BIGINT, $4::BIGINT, NOW()
      )`,
      [freshMatchId, nowTs - 3600, nowTs - 30, nowTs - 30]
    );
    console.log(`✅ Created fresh match: ${freshMatchId} (status=2, last_event_ts=${nowTs - 30}, fresh)`);

    // 3. Insert not-live match (status 1, stale but wrong status)
    const notLiveMatchId = 'phase3b_test_watchdog_notlive_1';
    await client.query(
      `INSERT INTO ts_matches (
        external_id, status_id, match_time,
        last_event_ts, provider_update_time, updated_at
      ) VALUES (
        $1, 1, $2::BIGINT,
        $3::BIGINT, $4::BIGINT, NOW() - INTERVAL '1000 seconds'
      )`,
      [notLiveMatchId, nowTs - 3600, nowTs - 1000, nowTs - 1000]
    );
    console.log(`✅ Created not-live match: ${notLiveMatchId} (status=1, should NOT be selected)`);

    // Run watchdog selection
    console.log(`\n🔍 Running findStaleLiveMatches(nowTs=${nowTs}, staleSeconds=120, halfTimeStaleSeconds=900, limit=50)...`);
    const allStales = await service.findStaleLiveMatches(nowTs, 120, 900, 50);

    // Filter to only test matches
    const stales = allStales.filter((s) => s.matchId.startsWith('phase3b_test_watchdog_'));

    console.log(`\n📊 Results: Found ${allStales.length} total stale match(es) (${stales.length} test matches)`);
    stales.forEach((stale) => {
      console.log(`  - match_id=${stale.matchId} status=${stale.statusId} reason=${stale.reason}`);
    });

    // Assertions (only on test matches)
    const staleIds = stales.map((s) => s.matchId);

    // Must contain stale match
    if (!staleIds.includes(staleMatchId)) {
      throw new Error(`❌ FAIL: Stale match ${staleMatchId} was NOT selected`);
    }
    console.log(`✅ PASS: Stale match ${staleMatchId} was correctly selected`);

    // Must NOT contain fresh match
    if (staleIds.includes(freshMatchId)) {
      throw new Error(`❌ FAIL: Fresh match ${freshMatchId} was incorrectly selected`);
    }
    console.log(`✅ PASS: Fresh match ${freshMatchId} was correctly excluded`);

    // Must NOT contain not-live match
    if (staleIds.includes(notLiveMatchId)) {
      throw new Error(`❌ FAIL: Not-live match ${notLiveMatchId} was incorrectly selected`);
    }
    console.log(`✅ PASS: Not-live match ${notLiveMatchId} was correctly excluded`);

    // Must have exactly 1 match
    if (stales.length !== 1) {
      throw new Error(`❌ FAIL: Expected exactly 1 stale match, got ${stales.length}`);
    }
    console.log(`✅ PASS: Exactly 1 stale match selected`);

    // Verify reason
    const selectedStale = stales[0];
    if (selectedStale.reason !== 'last_event_ts stale' && selectedStale.reason !== 'provider_update_time stale' && selectedStale.reason !== 'updated_at stale') {
      throw new Error(`❌ FAIL: Invalid reason: ${selectedStale.reason}`);
    }
    console.log(`✅ PASS: Reason correctly assigned: ${selectedStale.reason}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ DETERMINISTIC TEST PASSED: Watchdog selection verified');
    console.log('='.repeat(70));

  } finally {
    // Cleanup
    await client.query(`DELETE FROM ts_matches WHERE external_id LIKE 'phase3b_test_watchdog_%'`);
    client.release();
  }
}

async function main() {
  try {
    await testWatchdogSelection();
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

main();

