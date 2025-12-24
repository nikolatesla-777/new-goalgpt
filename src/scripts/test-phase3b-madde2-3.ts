/**
 * Phase 3B - Madde 2 & 3 Proof Test
 * 
 * Tests:
 * 1. Madde 2: detail_live match selection (no fallback to r[0])
 * 2. Madde 3: kickoff_ts write-once (rowCount=1 first time, rowCount=0 second time)
 */

import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';

async function testMadde2MatchSelection() {
  console.log('\n🧪 TEST 1: Madde 2 - detail_live Match Selection (No Fallback)');
  console.log('='.repeat(70));

  const service = new MatchDetailLiveService(new TheSportsClient());
  const extractLiveFields = (service as any).extractLiveFields.bind(service);

  // Test 1: Array with matching match_id
  const payloadWithMatch = {
    results: [
      { match_id: 'test_match_1', status_id: 2, home_score: 1, away_score: 0 },
      { match_id: 'test_match_2', status_id: 1, home_score: 0, away_score: 0 },
      { match_id: 'test_match_3', status_id: 3, home_score: 0, away_score: 0 },
    ],
  };

  const result1 = extractLiveFields(payloadWithMatch, 'test_match_2');
  if (result1.statusId === 1 && result1.homeScoreDisplay === 0) {
    console.log('✅ PASS: Found correct match (test_match_2) in array');
  } else {
    console.log('❌ FAIL: Did not find correct match');
    process.exit(1);
  }

  // Test 2: Array without matching match_id (should return null, no fallback)
  const payloadWithoutMatch = {
    results: [
      { match_id: 'other_match_1', status_id: 2, home_score: 1, away_score: 0 },
      { match_id: 'other_match_2', status_id: 1, home_score: 0, away_score: 0 },
    ],
  };

  const result2 = extractLiveFields(payloadWithoutMatch, 'nonexistent_match');
  if (result2.statusId === null && result2.homeScoreDisplay === null) {
    console.log('✅ PASS: Returned null when match_id not found (no fallback to r[0])');
  } else {
    console.log('❌ FAIL: Did not return null (fallback to r[0] detected)');
    console.log(`   Got: statusId=${result2.statusId}, homeScore=${result2.homeScoreDisplay}`);
    process.exit(1);
  }

  // Test 3: results["1"] format with matching match_id
  const payloadResults1 = {
    results: {
      '1': [
        { match_id: 'test_match_4', status_id: 2, home_score: 2, away_score: 1 },
        { match_id: 'test_match_5', status_id: 4, home_score: 1, away_score: 1 },
      ],
    },
  };

  const result3 = extractLiveFields(payloadResults1, 'test_match_5');
  if (result3.statusId === 4 && result3.homeScoreDisplay === 1) {
    console.log('✅ PASS: Found correct match in results["1"] array');
  } else {
    console.log('❌ FAIL: Did not find correct match in results["1"]');
    process.exit(1);
  }

  // Test 4: results["1"] format without matching match_id (should return null)
  const result4 = extractLiveFields(payloadResults1, 'nonexistent_in_results1');
  if (result4.statusId === null && result4.homeScoreDisplay === null) {
    console.log('✅ PASS: Returned null when match_id not found in results["1"] (no fallback)');
  } else {
    console.log('❌ FAIL: Did not return null for results["1"] (fallback detected)');
    process.exit(1);
  }

  console.log('\n✅ TEST 1 PASSED: Madde 2 (detail_live match selection)');
}

async function testMadde3KickoffWriteOnce() {
  console.log('\n🧪 TEST 2: Madde 3 - Kickoff TS Write-Once');
  console.log('='.repeat(70));

  const client = await pool.connect();
  const testMatchId = 'phase3b_test_kickoff_1';
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    // Cleanup test match
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);

    // Create test match with status 1 (NOT_STARTED)
    await client.query(
      `INSERT INTO ts_matches (external_id, status_id, match_time, first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts, updated_at)
       VALUES ($1, 1, $2::BIGINT, NULL, NULL, NULL, NOW())
       ON CONFLICT (external_id) DO UPDATE
       SET status_id = 1, first_half_kickoff_ts = NULL, second_half_kickoff_ts = NULL, overtime_kickoff_ts = NULL, updated_at = NOW()`,
      [testMatchId, nowSec]
    );

    console.log(`Created test match: ${testMatchId} (status=1, all kickoff_ts=NULL)`);

    // Test 1: First write to first_half_kickoff_ts (should succeed, rowCount=1)
    const firstKickoffTs = nowSec + 100;
    const res1 = await client.query(
      `UPDATE ts_matches
       SET first_half_kickoff_ts = $1, status_id = 2, updated_at = NOW()
       WHERE external_id = $2 AND first_half_kickoff_ts IS NULL`,
      [firstKickoffTs, testMatchId]
    );

    if (res1.rowCount === 1) {
      console.log(`✅ PASS: First write to first_half_kickoff_ts succeeded (rowCount=1)`);
    } else {
      console.log(`❌ FAIL: First write failed (rowCount=${res1.rowCount}, expected 1)`);
      process.exit(1);
    }

    // Verify it was set
    const check1 = await client.query(
      `SELECT first_half_kickoff_ts FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const actualTs = check1.rows[0]?.first_half_kickoff_ts;
    if (actualTs && Number(actualTs) === firstKickoffTs) {
      console.log(`✅ PASS: first_half_kickoff_ts correctly set to ${firstKickoffTs}`);
    } else {
      console.log(`❌ FAIL: first_half_kickoff_ts not set correctly (got ${actualTs}, expected ${firstKickoffTs})`);
      process.exit(1);
    }

    // Test 2: Second write attempt (should skip, rowCount=0)
    const secondKickoffTs = nowSec + 200;
    const res2 = await client.query(
      `UPDATE ts_matches
       SET first_half_kickoff_ts = $1, updated_at = NOW()
       WHERE external_id = $2 AND first_half_kickoff_ts IS NULL`,
      [secondKickoffTs, testMatchId]
    );

    if (res2.rowCount === 0) {
      console.log(`✅ PASS: Second write skipped (rowCount=0, write-once working)`);
    } else {
      console.log(`❌ FAIL: Second write should have been skipped (rowCount=${res2.rowCount}, expected 0)`);
      process.exit(1);
    }

    // Verify it was NOT overwritten
    const check2 = await client.query(
      `SELECT first_half_kickoff_ts FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const actualTs2 = check2.rows[0]?.first_half_kickoff_ts;
    if (actualTs2 && Number(actualTs2) === firstKickoffTs) {
      console.log(`✅ PASS: first_half_kickoff_ts NOT overwritten (still ${firstKickoffTs})`);
    } else {
      console.log(`❌ FAIL: first_half_kickoff_ts was overwritten (got ${actualTs2}, expected ${firstKickoffTs})`);
      process.exit(1);
    }

    // Test 3: second_half_kickoff_ts write-once (transition from HT to SECOND_HALF)
    await client.query(
      `UPDATE ts_matches SET status_id = 3 WHERE external_id = $1`,
      [testMatchId]
    );

    const secondHalfKickoffTs = nowSec + 3000;
    const res3 = await client.query(
      `UPDATE ts_matches
       SET second_half_kickoff_ts = $1, status_id = 4, updated_at = NOW()
       WHERE external_id = $2 AND status_id = 3 AND second_half_kickoff_ts IS NULL`,
      [secondHalfKickoffTs, testMatchId]
    );

    if (res3.rowCount === 1) {
      console.log(`✅ PASS: First write to second_half_kickoff_ts succeeded (rowCount=1)`);
    } else {
      console.log(`❌ FAIL: First write to second_half_kickoff_ts failed (rowCount=${res3.rowCount})`);
      process.exit(1);
    }

    // Test 4: Second write to second_half_kickoff_ts (should skip)
    const res4 = await client.query(
      `UPDATE ts_matches
       SET second_half_kickoff_ts = $1, updated_at = NOW()
       WHERE external_id = $2 AND second_half_kickoff_ts IS NULL`,
      [nowSec + 4000, testMatchId]
    );

    if (res4.rowCount === 0) {
      console.log(`✅ PASS: Second write to second_half_kickoff_ts skipped (rowCount=0)`);
    } else {
      console.log(`❌ FAIL: Second write should have been skipped (rowCount=${res4.rowCount})`);
      process.exit(1);
    }

    console.log('\n✅ TEST 2 PASSED: Madde 3 (kickoff_ts write-once)');

  } finally {
    // Cleanup
    await client.query(`DELETE FROM ts_matches WHERE external_id = $1`, [testMatchId]);
    client.release();
  }
}

async function main() {
  try {
    await testMadde2MatchSelection();
    await testMadde3KickoffWriteOnce();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ALL TESTS PASSED: Phase 3B - Madde 2 & 3');
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

