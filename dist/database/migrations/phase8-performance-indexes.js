"use strict";
/**
 * Phase 8: Performance Indexes Migration
 *
 * Optimized indexes for match detail page performance.
 * These indexes are designed for the specific query patterns used in getMatchFull.
 *
 * Key optimizations:
 * 1. Partial index for live matches - smaller index, faster lookups
 * 2. Composite index for match_time + competition - diary queries
 * 3. Composite index for status + updated_at - watchdog queries
 * 4. Index for season_id lookups - standings queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase8IndexMigration = runPhase8IndexMigration;
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function runPhase8IndexMigration() {
    const client = await connection_1.pool.connect();
    try {
        logger_1.logger.info('[Migration] Phase 8: Creating performance indexes...');
        // 1. Partial index for LIVE matches (status_id IN (2,3,4,5,7))
        // This is a small, focused index that speeds up live match queries
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_live_status
      ON ts_matches (status_id, match_time DESC)
      WHERE status_id IN (2, 3, 4, 5, 7);
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_matches_live_status (partial index for live matches)');
        // 2. Composite index for today's matches query
        // Used by: diary sync, livescore page
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_date_competition
      ON ts_matches (DATE(to_timestamp(match_time)), competition_id, match_time);
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_matches_date_competition (diary queries)');
        // 3. Index for NOT_STARTED matches (pre-sync queries)
        // Used by: lineupPreSync, h2hPreSync, statsSync
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_not_started
      ON ts_matches (match_time)
      WHERE status_id = 1;
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_matches_not_started (pre-sync queries)');
        // 4. Composite index for match lookup by external_id with status
        // Used by: getMatchFull, WebSocket invalidation
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_external_status
      ON ts_matches (external_id, status_id);
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_matches_external_status (match lookups)');
        // 5. Index for season_id lookups (standings)
        // Used by: getMatchFull -> standings
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_season
      ON ts_matches (season_id)
      WHERE season_id IS NOT NULL;
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_matches_season (standings lookups)');
        // 6. Index for ts_match_stats quick lookups
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_match_stats_updated
      ON ts_match_stats (match_id, last_updated_at DESC);
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_match_stats_updated (stats lookups)');
        // 7. Index for ts_standings quick lookups
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_standings_season_updated
      ON ts_standings (season_id, updated_at DESC);
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_standings_season_updated (standings lookups)');
        // 8. Index for watchdog stale match detection
        // Finds matches that need reconciliation
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_watchdog
      ON ts_matches (updated_at, status_id)
      WHERE status_id IN (2, 3, 4, 5, 7);
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_matches_watchdog (stale match detection)');
        // 9. Covering index for match list queries (includes commonly needed columns)
        // This allows index-only scans for basic match lists
        await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_matches_list_cover
      ON ts_matches (match_time DESC, status_id)
      INCLUDE (external_id, home_team_id, away_team_id, competition_id, home_score_display, away_score_display);
    `);
        logger_1.logger.info('[Migration] ✓ Created idx_matches_list_cover (covering index for match lists)');
        logger_1.logger.info('[Migration] Phase 8: All performance indexes created successfully');
    }
    catch (error) {
        // CONCURRENTLY can fail if index already exists, which is OK
        if (error.code === '42P07') {
            logger_1.logger.info('[Migration] Some indexes already exist, continuing...');
        }
        else {
            logger_1.logger.error('[Migration] Phase 8 failed:', error.message);
            throw error;
        }
    }
    finally {
        client.release();
    }
}
// Export for direct execution
exports.default = runPhase8IndexMigration;
