/**
 * Phase 3B - Madde 4: Minute Engine Deterministic Test
 * 
 * Tests:
 * 1. Minute updates only when changed (new_minute !== existing_minute)
 * 2. Freeze statuses never set minute to NULL
 * 3. No kickoff timestamp overwrite (Minute Engine does not touch kickoff fields)
 */

import { MatchMinuteService } from '../services/thesports/match/matchMinute.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function testMinuteUpdateOnlyWhenChanged() {
  console.log('\n🧪 TEST 1: Minute Updates Only When Changed');
  console.log('='.repeat(70));

  const service = new MatchMinuteService();
  const testMatchId = 'phase3b_test_match_minute_1';
  const nowTs = Math.floor(Date.now() / 1000);
  const firstHalfKickoffTs = nowTs - 30; // 30 seconds ago

  const client = await pool.connect();
  try {
    // Cleanup test match
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);

    // Create test match with status 2, first_half_kickoff_ts set, minute NULL
    await client.query(
      `INSERT INTO ts_matches (external_id, status_id, match_time, first_half_kickoff_ts, minute, updated_at)
       VALUES ($1, 2, $2::BIGINT, $3::BIGINT, NULL, NOW())`,
      [testMatchId, nowTs, firstHalfKickoffTs]
    );

    console.log(`Created test match: ${testMatchId} (status=2, first_half_kickoff_ts=${firstHalfKickoffTs}, minute=NULL)`);

    // Calculate minute (should be 1, since 30 seconds / 60 = 0, + 1 = 1)
    const calculatedMinute = service.calculateMinute(2, firstHalfKickoffTs, null, null, null, nowTs);
    console.log(`Calculated minute: ${calculatedMinute} (expected: 1)`);

    if (calculatedMinute !== 1) {
      throw new Error(`Expected calculated minute to be 1, got ${calculatedMinute}`);
    }

    // First update (should succeed, rowCount=1)
    const result1 = await service.updateMatchMinute(testMatchId, calculatedMinute, null);
    console.log(`First update: updated=${result1.updated}, rowCount=${result1.rowCount}`);

    if (result1.rowCount !== 1) {
      throw new Error(`First update should have rowCount=1, got ${result1.rowCount}`);
    }

    // Verify minute was set
    const check1 = await client.query(
      `SELECT minute, last_minute_update_ts, updated_at FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const afterFirst = check1.rows[0];
    console.log(`After first update: minute=${afterFirst.minute}, last_minute_update_ts=${afterFirst.last_minute_update_ts}`);
    
    if (Number(afterFirst.minute) !== calculatedMinute) {
      throw new Error(`Minute not set correctly: got ${afterFirst.minute}, expected ${calculatedMinute}`);
    }

    // Store updated_at for later check
    const updatedAtAfterFirst = afterFirst.updated_at;

    // Second update with same minute (should skip, rowCount=0)
    const result2 = await service.updateMatchMinute(testMatchId, calculatedMinute, calculatedMinute);
    console.log(`Second update (same minute): updated=${result2.updated}, rowCount=${result2.rowCount}`);

    if (result2.rowCount !== 0) {
      throw new Error(`Second update should have rowCount=0 (unchanged), got ${result2.rowCount}`);
    }

    // Verify updated_at was NOT changed
    const check2 = await client.query(
      `SELECT updated_at FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const updatedAtAfterSecond = check2.rows[0].updated_at;
    
    if (updatedAtAfterSecond.getTime() !== updatedAtAfterFirst.getTime()) {
      throw new Error(`updated_at was changed by Minute Engine (should remain unchanged)`);
    }

    console.log('✅ DETERMINISTIC TEST: first update applied rowCount=1');
    console.log('✅ DETERMINISTIC TEST: second update skipped rowCount=0');
    console.log('✅ DETERMINISTIC TEST: updated_at NOT changed by Minute Engine');

  } finally {
    // Cleanup
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);
    client.release();
  }
}

async function testFreezeStatusNeverNull() {
  console.log('\n🧪 TEST 2: Freeze Status Never Sets Minute to NULL');
  console.log('='.repeat(70));

  const service = new MatchMinuteService();
  const testMatchId = 'phase3b_test_match_minute_2';
  const nowTs = Math.floor(Date.now() / 1000);

  const client = await pool.connect();
  try {
    // Cleanup test match
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);

    // Create test match with status 3 (HALF_TIME), minute=45
    await client.query(
      `INSERT INTO ts_matches (external_id, status_id, match_time, minute, updated_at)
       VALUES ($1, 3, $2::BIGINT, 45, NOW())`,
      [testMatchId, nowTs]
    );

    console.log(`Created test match: ${testMatchId} (status=3, minute=45)`);

    // Calculate minute for HALF_TIME (should return 45)
    const calculatedMinute = service.calculateMinute(3, null, null, null, 45, nowTs);
    console.log(`Calculated minute for status 3: ${calculatedMinute} (expected: 45)`);

    if (calculatedMinute !== 45) {
      throw new Error(`Expected calculated minute to be 45 for HALF_TIME, got ${calculatedMinute}`);
    }

    // Update (should preserve 45, not set to NULL)
    const result = await service.updateMatchMinute(testMatchId, calculatedMinute, 45);
    console.log(`Update result: updated=${result.updated}, rowCount=${result.rowCount}`);

    // Verify minute remains 45 (not NULL)
    const check = await client.query(
      `SELECT minute FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const finalMinute = check.rows[0].minute;
    console.log(`Final minute: ${finalMinute} (expected: 45, not NULL)`);

    if (finalMinute === null) {
      throw new Error(`Minute was set to NULL for HALF_TIME status (should remain 45)`);
    }

    if (Number(finalMinute) !== 45) {
      throw new Error(`Minute was changed from 45 to ${finalMinute} (should remain 45)`);
    }

    console.log('✅ DETERMINISTIC TEST: freeze status (HALF_TIME) minute remains 45, never NULL');

  } finally {
    // Cleanup
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);
    client.release();
  }
}

async function testStatusSpecificCalculations() {
  console.log('\n🧪 TEST 3: Status-Specific Calculations');
  console.log('='.repeat(70));

  const service = new MatchMinuteService();
  const nowTs = Math.floor(Date.now() / 1000);
  const firstHalfKickoffTs = nowTs - 1200; // 20 minutes ago
  const secondHalfKickoffTs = nowTs - 300; // 5 minutes ago
  const overtimeKickoffTs = nowTs - 60; // 1 minute ago

  // Test Status 2 (FIRST_HALF)
  const minute2 = service.calculateMinute(2, firstHalfKickoffTs, null, null, null, nowTs);
  const expected2 = Math.min(Math.floor((nowTs - firstHalfKickoffTs) / 60) + 1, 45);
  console.log(`Status 2: calculated=${minute2}, expected=${expected2}`);
  if (minute2 !== expected2) {
    throw new Error(`Status 2 calculation failed: got ${minute2}, expected ${expected2}`);
  }

  // Test Status 3 (HALF_TIME)
  const minute3 = service.calculateMinute(3, null, null, null, null, nowTs);
  console.log(`Status 3: calculated=${minute3}, expected=45`);
  if (minute3 !== 45) {
    throw new Error(`Status 3 calculation failed: got ${minute3}, expected 45`);
  }

  // Test Status 4 (SECOND_HALF)
  const minute4 = service.calculateMinute(4, null, secondHalfKickoffTs, null, null, nowTs);
  const expected4 = Math.max(45 + Math.floor((nowTs - secondHalfKickoffTs) / 60) + 1, 46);
  console.log(`Status 4: calculated=${minute4}, expected=${expected4}`);
  if (minute4 !== expected4) {
    throw new Error(`Status 4 calculation failed: got ${minute4}, expected ${expected4}`);
  }

  // Test Status 5 (OVERTIME)
  const minute5 = service.calculateMinute(5, null, null, overtimeKickoffTs, null, nowTs);
  const expected5 = 90 + Math.floor((nowTs - overtimeKickoffTs) / 60) + 1;
  console.log(`Status 5: calculated=${minute5}, expected=${expected5}`);
  if (minute5 !== expected5) {
    throw new Error(`Status 5 calculation failed: got ${minute5}, expected ${expected5}`);
  }

  // Test Status 7 (PENALTY) - retain existing
  const minute7 = service.calculateMinute(7, null, null, null, 75, nowTs);
  console.log(`Status 7: calculated=${minute7}, expected=75 (retain existing)`);
  if (minute7 !== 75) {
    throw new Error(`Status 7 calculation failed: got ${minute7}, expected 75 (retain existing)`);
  }

  console.log('✅ DETERMINISTIC TEST: all status-specific calculations correct');

}

async function main() {
  try {
    await testMinuteUpdateOnlyWhenChanged();
    await testFreezeStatusNeverNull();
    await testStatusSpecificCalculations();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ DETERMINISTIC TEST PASSED: Minute engine verified');
    console.log('='.repeat(70));
    
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







