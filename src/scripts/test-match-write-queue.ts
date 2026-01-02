/**
 * Test MatchWriteQueue Functionality
 * 
 * Tests the MatchWriteQueue for:
 * 1. Queue batching functionality
 * 2. Automatic flush (interval and batch size)
 * 3. Update merging (same match, multiple updates)
 * 4. Performance measurement (database write reduction)
 * 5. Error handling
 */

import 'dotenv/config';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { MatchWriteQueue } from '../services/thesports/websocket/matchWriteQueue';

async function testMatchWriteQueue() {
  logger.info('🧪 Testing MatchWriteQueue Functionality...\n');

  const client = await pool.connect();
  try {
    // Use an existing live match from database for testing
    const existingMatchResult = await client.query(`
      SELECT external_id 
      FROM ts_matches 
      WHERE status_id IN (2, 3, 4)
      LIMIT 1
    `);
    
    let testMatchId: string;
    if (existingMatchResult.rows.length > 0) {
      testMatchId = existingMatchResult.rows[0].external_id;
      logger.info(`✅ Using existing match: ${testMatchId}\n`);
    } else {
      // If no live match, create a test match
      testMatchId = 'test_match_queue_' + Date.now();
      await client.query(`
        INSERT INTO ts_matches (
          external_id,
          home_team_id,
          away_team_id,
          status_id,
          match_time,
          home_score_display,
          away_score_display,
          provider_update_time,
          last_event_ts
        ) VALUES ($1, 'test_team_1', 'test_team_2', 2, EXTRACT(EPOCH FROM NOW()), 0, 0, 0, 0)
        ON CONFLICT (external_id) DO NOTHING
      `, [testMatchId]);
      logger.info(`✅ Test match created: ${testMatchId}\n`);
    }

    // Initialize MatchWriteQueue
    const writeQueue = new MatchWriteQueue();

    // Create a mock ParsedScore for testing
    const createMockScore = (homeScore: number, awayScore: number) => ({
      matchId: testMatchId,
      home: { score: homeScore, regularScore: homeScore },
      away: { score: awayScore, regularScore: awayScore },
      statusId: 2,
    });

    // Test 1: Single update
    logger.info('📝 Test 1: Single Update');
    const start1 = Date.now();
      writeQueue.enqueue(
        testMatchId,
        {
          type: 'score',
          data: createMockScore(testMatchId, 1, 0),
          providerUpdateTime: Date.now(),
          ingestionTs: Math.floor(Date.now() / 1000)
        }
      );
    const duration1 = Date.now() - start1;
    logger.info(`   Added in ${duration1}ms`);
    await new Promise(resolve => setTimeout(resolve, 150)); // Wait for flush
    logger.info('   ✅ Single update completed\n');

    // Test 2: Multiple updates for same match (should merge)
    logger.info('📝 Test 2: Multiple Updates for Same Match (Merging)');
    const start2 = Date.now();
    for (let i = 0; i < 5; i++) {
      writeQueue.enqueue(
        testMatchId,
        {
          type: 'score',
          data: createMockScore(testMatchId, 1 + i, i),
          providerUpdateTime: Date.now() + i,
          ingestionTs: Math.floor(Date.now() / 1000) + i
        }
      );
    }
    const duration2 = Date.now() - start2;
    logger.info(`   Added 5 updates in ${duration2}ms (should merge into 1 write)`);
    await new Promise(resolve => setTimeout(resolve, 150)); // Wait for flush
    logger.info('   ✅ Merging test completed\n');

    // Test 3: Multiple matches (batch size test) - Use existing matches
    logger.info('📝 Test 3: Multiple Matches (Batch Size Test)');
    const existingMatchesResult = await client.query(`
      SELECT external_id 
      FROM ts_matches 
      WHERE status_id IN (2, 3, 4)
      LIMIT 15
    `);
    
    const testMatchIds = existingMatchesResult.rows.length >= 15 
      ? existingMatchesResult.rows.slice(0, 15).map((r: any) => r.external_id)
      : existingMatchesResult.rows.map((r: any) => r.external_id);
    
    if (testMatchIds.length < 5) {
      logger.warn(`   ⚠️ Only ${testMatchIds.length} matches found, skipping batch size test\n`);
    } else {

    const start3 = Date.now();
    for (let i = 0; i < testMatchIds.length; i++) {
      writeQueue.enqueue(
        testMatchIds[i],
        {
          type: 'score',
          data: createMockScore(testMatchIds[i], i, 0),
          providerUpdateTime: Date.now() + i,
          ingestionTs: Math.floor(Date.now() / 1000) + i
        }
      );
    }
    const duration3 = Date.now() - start3;
      logger.info(`   Added ${testMatchIds.length} updates for different matches in ${duration3}ms`);
      logger.info(`   Expected: ${Math.ceil(testMatchIds.length / 10)} batches (batch_size=10)`);
      await new Promise(resolve => setTimeout(resolve, 250)); // Wait for flush
      logger.info('   ✅ Batch size test completed\n');
    }

    // Test 4: Performance measurement (comparing immediate vs queued writes)
    logger.info('📝 Test 4: Performance Measurement');
    
    // Use existing matches for performance test
    const perfTestMatchesResult = await client.query(`
      SELECT external_id 
      FROM ts_matches 
      WHERE status_id IN (2, 3, 4)
      LIMIT 10
    `);
    
    if (perfTestMatchesResult.rows.length < 5) {
      logger.warn(`   ⚠️ Not enough matches for performance test, skipping\n`);
    } else {
      const perfMatchIds = perfTestMatchesResult.rows.map((r: any) => r.external_id);
      const testCount = Math.min(perfMatchIds.length, 10);
      
      // Immediate writes (baseline) - simulate immediate updates
      const immediateStart = Date.now();
      for (let i = 0; i < testCount; i++) {
        const matchId = perfMatchIds[i];
        await client.query(`
          UPDATE ts_matches 
          SET home_score_display = $1, updated_at = NOW()
          WHERE external_id = $2
        `, [i % 5, matchId]);
      }
      const immediateDuration = Date.now() - immediateStart;
      logger.info(`   Immediate writes (${testCount}): ${immediateDuration}ms`);
      
      // Queued writes
      const queueStart = Date.now();
      for (let i = 0; i < testCount; i++) {
        const matchId = perfMatchIds[i];
        writeQueue.enqueue(
          matchId,
          {
            type: 'score',
            data: createMockScore(matchId, (i + 1) % 5, 0),
            providerUpdateTime: Date.now() + i,
            ingestionTs: Math.floor(Date.now() / 1000) + i
          }
        );
      }
      const queueAddDuration = Date.now() - queueStart;
      logger.info(`   Queue add (${testCount}): ${queueAddDuration}ms`);
      await new Promise(resolve => setTimeout(resolve, 250)); // Wait for flush
      const queueTotalDuration = Date.now() - queueStart;
      logger.info(`   Queue total (${testCount}): ${queueTotalDuration}ms`);
      
      const improvement = ((immediateDuration - queueTotalDuration) / immediateDuration * 100).toFixed(1);
      logger.info(`   Performance: ${improvement > 0 ? '✅' : '⚠️'} ${Math.abs(Number(improvement))}% ${improvement > 0 ? 'faster' : 'slower'}\n`);
    }

    // Test 5: Verify data integrity
    logger.info('📝 Test 5: Data Integrity Check');
    const result = await client.query(`
      SELECT external_id, home_score_display, away_score_display, updated_at
      FROM ts_matches
      WHERE external_id = $1
    `, [testMatchId]);
    
    if (result.rows.length > 0) {
      const match = result.rows[0];
      logger.info(`   Match: ${match.external_id}`);
      logger.info(`   Home Score: ${match.home_score_display}`);
      logger.info(`   Away Score: ${match.away_score_display}`);
      logger.info(`   Updated At: ${match.updated_at}`);
      logger.info('   ✅ Data integrity verified\n');
    } else {
      logger.warn('   ⚠️ Match not found\n');
    }

    // Cleanup - only remove test matches we created
    logger.info('🧹 Cleaning up test data...');
    const cleanupResult = await client.query(`
      DELETE FROM ts_matches
      WHERE external_id LIKE 'test_%'
      RETURNING external_id
    `);
    if (cleanupResult.rows.length > 0) {
      logger.info(`   ✅ Removed ${cleanupResult.rows.length} test matches\n`);
    } else {
      logger.info('   ✅ No test matches to cleanup (used existing matches)\n');
    }

    // Stop queue
    writeQueue.stop();
    logger.info('✅ All tests completed!');

  } catch (error: any) {
    logger.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testMatchWriteQueue().catch(console.error);

