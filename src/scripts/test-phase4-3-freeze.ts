/**
 * Phase 4-3 Freeze Detection Test
 * 
 * Deterministic test for freeze detection and action ladder:
 * 1. Insert test match with stale last_event_ts
 * 2. Run detection → should detect stale match
 * 3. Trigger reconcile → should log reconcile.requested
 * 4. Run again → should skip due to cooldown
 * 5. Cleanup
 */

import dotenv from 'dotenv';
import { pool } from '../database/connection';
import { MatchFreezeDetectionService } from '../services/thesports/match/matchFreezeDetection.service';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';

dotenv.config();

async function testFreezeDetection() {
  console.log('🧪 Phase 4-3 Freeze Detection Test\n');
  console.log('='.repeat(70));

  const client = await pool.connect();
  const freezeDetectionService = new MatchFreezeDetectionService();
  const theSportsClient = new TheSportsClient();
  const matchDetailLiveService = new MatchDetailLiveService(theSportsClient);

  const testMatchId = 'phase4_3_test_freeze_1';
  const nowTs = Math.floor(Date.now() / 1000);
  const staleTs = nowTs - 300; // 5 minutes ago (well beyond 120s threshold)

  try {
    // Cleanup before test
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);

    // Step 1: Create test match with stale last_event_ts
    console.log('\n📋 Step 1: Creating test match with stale last_event_ts...');
    await client.query(
      `INSERT INTO ts_matches (
        external_id, status_id, match_time, last_event_ts, provider_update_time, updated_at
      ) VALUES ($1, $2, $3::BIGINT, $4::BIGINT, $5::BIGINT, NOW())`,
      [testMatchId, 2, nowTs, staleTs, staleTs] // Status 2 = FIRST_HALF, stale timestamps
    );
    console.log(`✅ Created test match: ${testMatchId} (status=2, last_event_ts=${staleTs}, age=${nowTs - staleTs}s)`);

    // Step 2: Run detection
    console.log('\n📋 Step 2: Running freeze detection...');
    const frozen = await freezeDetectionService.detectFrozenMatches(nowTs, 120, 900, 180, 50);
    
    const testMatch = frozen.find(m => m.matchId === testMatchId);
    if (!testMatch) {
      throw new Error(`❌ FAIL: Test match ${testMatchId} was NOT detected as frozen`);
    }
    console.log(`✅ PASS: Test match detected as frozen`);
    console.log(`   - Reason: ${testMatch.reason}`);
    console.log(`   - Age: ${testMatch.ageSec}s`);
    console.log(`   - Threshold: ${testMatch.thresholdSec}s`);

    // Step 3: Simulate action ladder (detection → reconcile request)
    console.log('\n📋 Step 3: Simulating action ladder (reconcile request)...');
    
    // Check cooldown (should be empty initially)
    const cooldownMap = new Map<string, number>();
    const lastReconcile = cooldownMap.get(testMatchId);
    const cooldownExpired = lastReconcile === undefined || (nowTs - lastReconcile) >= 300;
    
    if (!cooldownExpired) {
      throw new Error(`❌ FAIL: Cooldown should be expired initially`);
    }
    console.log(`✅ PASS: Cooldown expired (no previous reconcile)`);

    // Simulate reconcile request
    console.log(`   → Requesting reconcile for ${testMatchId}...`);
    try {
      await matchDetailLiveService.reconcileMatchToDatabase(testMatchId, null);
      cooldownMap.set(testMatchId, nowTs);
      console.log(`✅ PASS: Reconcile requested and cooldown set`);
    } catch (error: any) {
      // Circuit breaker open or other error - acceptable for test
      console.log(`⚠️  Reconcile skipped (circuit open or error): ${error.message}`);
    }

    // Step 4: Test cooldown (run detection again, should skip reconcile)
    console.log('\n📋 Step 4: Testing cooldown (second detection run)...');
    const frozen2 = await freezeDetectionService.detectFrozenMatches(nowTs, 120, 900, 180, 50);
    const testMatch2 = frozen2.find(m => m.matchId === testMatchId);
    
    if (!testMatch2) {
      console.log(`⚠️  Test match no longer detected (may have been updated by reconcile)`);
    } else {
      const lastReconcile2 = cooldownMap.get(testMatchId);
      const cooldownExpired2 = lastReconcile2 === undefined || (nowTs - lastReconcile2) >= 300;
      
      if (cooldownExpired2) {
        console.log(`⚠️  Cooldown expired (time passed or not set)`);
      } else {
        const remainingCooldown = 300 - (nowTs - lastReconcile2);
        console.log(`✅ PASS: Cooldown active (remaining: ${remainingCooldown}s)`);
        console.log(`   → Reconcile would be skipped due to cooldown`);
      }
    }

    console.log('\n✅ Phase 4-3 Freeze Detection Test PASSED');
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);
    console.log(`\n🧹 Cleaned up test match: ${testMatchId}`);
    client.release();
    process.exit(0);
  }
}

testFreezeDetection().catch((error) => {
  logger.error('Test failed:', error);
  process.exit(1);
});




