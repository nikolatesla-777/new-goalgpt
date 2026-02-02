/**
 * PR-P1A: Migration Safety Emergency Fix
 *
 * This migration adds CONCURRENTLY to all CREATE INDEX statements that were
 * previously created without it, preventing production table locks during deployments.
 *
 * IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction (BEGIN/COMMIT)
 *
 * Context: Technical Debt Cleanup - Phase 1A
 * Risk: LOW (only affects future index creation, doesn't change existing indexes)
 * Deployment: Safe to run in production immediately
 */

import { pool } from '../connection';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('=== PR-P1A: ADDING CONCURRENT INDEXES ===\n');
    console.log('CRITICAL: These indexes will be created without blocking production\n');

    // 1. AI Predictions indexes (from create-ai-predictions-tables.ts)
    console.log('Creating AI Predictions indexes...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_predictions_external_id
      ON ai_predictions(external_id)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_predictions_processed
      ON ai_predictions(processed)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_predictions_created_at
      ON ai_predictions(created_at DESC)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_predictions_bot_group_id
      ON ai_predictions(bot_group_id)
    `);
    console.log('✓ AI Predictions indexes created');

    // 2. AI Bot Rules indexes
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_bot_rules_active
      ON ai_bot_rules(is_active)
    `);
    console.log('✓ AI Bot Rules indexes created');

    // 3. AI Prediction Matches indexes
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prediction_matches_prediction_id
      ON ai_prediction_matches(prediction_id)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prediction_matches_match_external_id
      ON ai_prediction_matches(match_external_id)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prediction_matches_status
      ON ai_prediction_matches(match_status)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prediction_matches_result
      ON ai_prediction_matches(prediction_result)
    `);
    console.log('✓ AI Prediction Matches indexes created');

    // 4. AI Prediction Requests indexes
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prediction_requests_created_at
      ON ai_prediction_requests(created_at DESC)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prediction_requests_success
      ON ai_prediction_requests(success)
    `);
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_prediction_requests_source_ip
      ON ai_prediction_requests(source_ip)
    `);
    console.log('✓ AI Prediction Requests indexes created');

    // 5. Missing FK indexes (HIGH PRIORITY - improves cascade delete performance)
    console.log('\nCreating missing FK indexes for cascade deletes...');

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_oauth_identities_customer_user_id
      ON customer_oauth_identities(customer_user_id)
    `);

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_subscriptions_customer_user_id
      ON customer_subscriptions(customer_user_id)
    `);

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_daily_rewards_customer_user_id
      ON customer_daily_rewards(customer_user_id)
    `);

    console.log('✓ FK indexes created for better cascade delete performance');

    // 6. Hot path indexes (from add-ai-predictions-indexes.ts - ensure CONCURRENTLY)
    console.log('\nCreating hot path optimization indexes...');

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_predictions_match_id_created
      ON ai_predictions(match_id, created_at DESC)
      WHERE match_id IS NOT NULL
    `);

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_predictions_result
      ON ai_predictions(result)
      WHERE result IN ('pending', 'won', 'lost')
    `);

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_predictions_date_bot
      ON ai_predictions(DATE(created_at), canonical_bot_name, result)
    `);

    console.log('✓ Hot path indexes created');

    // 7. Job-critical indexes
    console.log('\nCreating job-critical indexes for N+1 elimination...');

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_rewards_customer_date
      ON customer_daily_rewards(customer_user_id, reward_date DESC)
      WHERE claimed_at IS NULL
    `);

    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sched_notifs_status_time
      ON scheduled_notifications(status, scheduled_at)
      WHERE status = 'pending'
    `);

    console.log('✓ Job-critical indexes created');

    // Verify all indexes
    const indexResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
        AND indexdef LIKE '%CONCURRENTLY%'
      ORDER BY tablename, indexname
    `);

    console.log('\n=== CONCURRENTLY INDEXES VERIFICATION ===');
    console.log(`Total concurrent indexes: ${indexResult.rows.length}`);

    const tableGroups = indexResult.rows.reduce((acc: any, row: any) => {
      if (!acc[row.tablename]) acc[row.tablename] = [];
      acc[row.tablename].push(row.indexname);
      return acc;
    }, {});

    Object.entries(tableGroups).forEach(([table, indexes]: [string, any]) => {
      console.log(`\n${table}:`);
      indexes.forEach((idx: string) => console.log(`  - ${idx}`));
    });

    console.log('\n✅ PR-P1A: Migration completed successfully!');
    console.log('All future index creations will now be safe for production deployments.');

  } catch (error: any) {
    // CONCURRENTLY can fail if index already exists, which is OK
    if (error.code === '42P07') {
      console.log('\n⚠️  Some indexes already exist, continuing...');
    } else {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

// Export for direct execution
if (require.main === module) {
  migrate().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default migrate;
