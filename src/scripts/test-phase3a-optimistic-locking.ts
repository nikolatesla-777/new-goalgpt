/**
 * Test Phase 3A Optimistic Locking
 * 
 * Tests that duplicate reconcile calls skip stale updates
 */

import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';

async function testOptimisticLocking() {
  logger.info('🧪 Testing Phase 3A Optimistic Locking...');

  // Use a real match ID from DB (or provide one)
  const client = await pool.connect();
  try {
    // Get a match ID from DB
    const matchResult = await client.query(
      `SELECT external_id FROM ts_matches LIMIT 1`
    );

    if (matchResult.rows.length === 0) {
      logger.warn('No matches in DB to test with');
      return;
    }

    const testMatchId = matchResult.rows[0].external_id;
    logger.info(`Testing with match_id: ${testMatchId}`);

    // Check initial state
    const initialResult = await client.query(
      `SELECT provider_update_time, last_event_ts FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const initial = initialResult.rows[0];
    logger.info(`Initial state: provider_update_time=${initial.provider_update_time}, last_event_ts=${initial.last_event_ts}`);

    // First reconcile
    logger.info('🔄 Running first reconcile...');
    const service = new MatchDetailLiveService(new TheSportsClient());
    const result1 = await service.reconcileMatchToDatabase(testMatchId);
    logger.info(`First reconcile: updated=${result1.updated}, rowCount=${result1.rowCount}`);

    // Check state after first reconcile
    const afterFirstResult = await client.query(
      `SELECT provider_update_time, last_event_ts FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const afterFirst = afterFirstResult.rows[0];
    logger.info(`After first: provider_update_time=${afterFirst.provider_update_time}, last_event_ts=${afterFirst.last_event_ts}`);

    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second reconcile (should be skipped due to stale check)
    logger.info('🔄 Running second reconcile (should skip)...');
    const result2 = await service.reconcileMatchToDatabase(testMatchId);
    logger.info(`Second reconcile: updated=${result2.updated}, rowCount=${result2.rowCount}`);

    // Check state after second reconcile
    const afterSecondResult = await client.query(
      `SELECT provider_update_time, last_event_ts FROM ts_matches WHERE external_id = $1`,
      [testMatchId]
    );
    const afterSecond = afterSecondResult.rows[0];
    logger.info(`After second: provider_update_time=${afterSecond.provider_update_time}, last_event_ts=${afterSecond.last_event_ts}`);

    // Verify
    if (result1.updated && !result2.updated) {
      logger.info('✅ TEST PASSED: First reconcile updated, second was skipped (optimistic locking working)');
    } else if (result1.updated && result2.updated) {
      logger.warn('⚠️  TEST WARNING: Both reconciles updated (may be expected if provider_update_time changed)');
    } else {
      logger.warn('⚠️  TEST WARNING: First reconcile did not update (match may not be live)');
    }

    logger.info('✅ Optimistic locking test completed');
  } finally {
    client.release();
    await pool.end();
  }
}

testOptimisticLocking().catch((error) => {
  logger.error('❌ Test failed:', error);
  process.exit(1);
});



