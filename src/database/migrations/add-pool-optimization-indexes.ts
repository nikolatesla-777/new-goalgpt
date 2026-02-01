import { pool } from '../connection';
import { logger } from '../../utils/logger';

/**
 * PR-P0-2: Add critical indexes to reduce pool exhaustion
 *
 * Uses CREATE INDEX CONCURRENTLY for zero-downtime deployment.
 * Safe to run on production - no table locks.
 *
 * IMPORTANT: Does NOT duplicate phase8 indexes
 * - phase8 already has: idx_matches_live_status (composite on status_id, match_time)
 * - This migration adds COVERING index (more efficient with INCLUDE clause)
 *
 * Indexes created:
 * 1. idx_ts_matches_live_covering - Covering index for live matches (enables Index-Only Scans)
 * 2. idx_telegram_daily_lists_settlement_enhanced - Enhanced partial index for settlement job
 * 3. idx_customer_subscriptions_dashboard - Composite index for dashboard queries
 *
 * Expected impact: 40-60% query speedup on hot paths
 */
export async function addPoolOptimizationIndexes(): Promise<void> {
  const client = await pool.connect();

  try {
    logger.info('[Migration:P0-2] Creating performance indexes (CONCURRENTLY)...');
    logger.info('[Migration:P0-2] Note: Skipping composite index (phase8 already has idx_matches_live_status)');

    // Index 1: Live matches COVERING index (Priority 1 - CRITICAL)
    // Target query: /api/matches/live (15+ second response times)
    // File: src/services/thesports/match/matchDatabase.service.ts:308-386
    // INCLUDE clause enables Index-Only Scans, eliminating heap fetches
    // More efficient than phase8's idx_matches_live_status (composite without INCLUDE)
    logger.info('[Migration:P0-2] Creating idx_ts_matches_live_covering...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_matches_live_covering
      ON ts_matches (status_id, match_time DESC)
      INCLUDE (external_id, minute, home_score_display, away_score_display, competition_id)
      WHERE status_id IN (2, 3, 4, 5, 7);
    `);
    logger.info('[Migration:P0-2] ✓ idx_ts_matches_live_covering created');

    // Index 2: Daily lists settlement enhanced (Priority 2)
    // Target query: Daily lists settlement job (6-7 second queries)
    // File: src/jobs/dailyListsSettlement.job.ts:72-88
    // Schedule: Every 15 minutes
    logger.info('[Migration:P0-2] Creating idx_telegram_daily_lists_settlement_enhanced...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telegram_daily_lists_settlement_enhanced
      ON telegram_daily_lists (status, settled_at, list_date DESC, market)
      WHERE status = 'active'
        AND settled_at IS NULL
        AND telegram_message_id IS NOT NULL;
    `);
    logger.info('[Migration:P0-2] ✓ idx_telegram_daily_lists_settlement_enhanced created');

    // Index 3: Subscription dashboard (Priority 3)
    // Target query: Dashboard subscription metrics (5-10 second aggregations)
    // File: src/services/dashboard.service.ts:108-117
    logger.info('[Migration:P0-2] Creating idx_customer_subscriptions_dashboard...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_subscriptions_dashboard
      ON customer_subscriptions (status, created_at DESC)
      WHERE status NOT IN ('canceled', 'expired');
    `);
    logger.info('[Migration:P0-2] ✓ idx_customer_subscriptions_dashboard created');

    logger.info('[Migration:P0-2] All 3 indexes created successfully');
    logger.info('[Migration:P0-2] Expected impact: 40-60% query speedup on hot paths');

  } catch (error: any) {
    if (error.code === '42P07') {
      // Duplicate object error - index already exists
      logger.info('[Migration:P0-2] Some indexes already exist (safe to continue)');
    } else {
      logger.error('[Migration:P0-2] Migration failed:', error);
      throw error;
    }
  } finally {
    client.release();
  }
}

// Allow direct execution
if (require.main === module) {
  addPoolOptimizationIndexes()
    .then(() => {
      logger.info('[Migration:P0-2] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Migration:P0-2] Migration failed:', error);
      process.exit(1);
    });
}

export default addPoolOptimizationIndexes;
