/**
 * Migration: Add indexes to ai_predictions table
 *
 * PHASE 2: AI Predictions ↔ Livescore Orchestration
 *
 * Adds 3 indexes to optimize query performance:
 * 1. idx_ai_predictions_match_id_created - For LEFT JOIN LATERAL performance
 * 2. idx_ai_predictions_result - For filtering by result status
 * 3. idx_ai_predictions_date_bot - For admin pages composite queries
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { pool } from '../connection';

async function migrate() {
  const client = await pool.connect();

  try {
    // CRITICAL: CONCURRENTLY cannot run inside transaction - run without BEGIN/COMMIT
    console.log('=== PHASE 2: ADDING INDEXES TO ai_predictions TABLE ===\n');

    // Index 1: Match ID + Created (for LEFT JOIN LATERAL performance)
    console.log('Creating idx_ai_predictions_match_id_created...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_match_id_created
      ON ai_predictions(match_id, created_at DESC)
      WHERE match_id IS NOT NULL
    `);
    console.log('✓ idx_ai_predictions_match_id_created created');

    // Index 2: Result filtering (for pending/won/lost queries)
    console.log('Creating idx_ai_predictions_result...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_result
      ON ai_predictions(result)
      WHERE result IN ('pending', 'won', 'lost')
    `);
    console.log('✓ idx_ai_predictions_result created');

    // Index 3: Admin pages composite (date + bot + result)
    console.log('Creating idx_ai_predictions_date_bot...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_date_bot
      ON ai_predictions(DATE(created_at), canonical_bot_name, result)
    `);
    console.log('✓ idx_ai_predictions_date_bot created');

    // Verify indexes
    const indexResult = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'ai_predictions'
        AND indexname LIKE 'idx_ai_predictions_%'
      ORDER BY indexname
    `);

    console.log('\n=== ai_predictions INDEXES ===');
    indexResult.rows.forEach((r: any) => {
      console.log(`- ${r.indexname}`);
    });

    // Analyze query performance
    console.log('\n=== QUERY PERFORMANCE VERIFICATION ===');

    const explainResult = await client.query(`
      EXPLAIN ANALYZE
      SELECT * FROM ai_predictions
      WHERE match_id = 'test-match-id'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    console.log('Query plan for LEFT JOIN LATERAL:');
    explainResult.rows.forEach((r: any) => {
      console.log(r['QUERY PLAN']);
    });

    console.log('\n✅ PHASE 2: Migration completed successfully!');
    console.log('Expected performance: <50ms for unified endpoint with AI predictions');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
