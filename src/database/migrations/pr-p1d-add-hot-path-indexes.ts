import { Pool } from 'pg';
import { logger } from '../../utils/logger';

/**
 * PR-P1D: Add Hot Path Indexes
 *
 * Creates indexes for frequently accessed query patterns to improve performance:
 * - Player queries by team_id and position
 * - Fixture queries by league_id and date
 * - Customer predictions by user_id and match_id
 * - Team fixtures for standings/recent form queries
 *
 * All indexes use CONCURRENTLY to prevent table locks (PR-P1A pattern)
 *
 * Expected Impact:
 * - ts_players lineup query: 300ms → <50ms
 * - ts_fixtures date range query: 200ms → <30ms
 * - customer_predictions by user: 150ms → <20ms
 */
export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    logger.info('[Migration PR-P1D] Creating hot path indexes...');

    // 1. Players - Optimize team lineup queries
    logger.info('[Migration PR-P1D] Creating idx_ts_players_team_position...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_players_team_position
      ON ts_players(team_id, position)
      WHERE deleted_at IS NULL
    `);

    // 2. Players - Optimize position-based queries
    logger.info('[Migration PR-P1D] Creating idx_ts_players_position...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_players_position
      ON ts_players(position)
      WHERE deleted_at IS NULL AND team_id IS NOT NULL
    `);

    // 3. Fixtures - Optimize league fixtures queries
    logger.info('[Migration PR-P1D] Creating idx_ts_fixtures_league_date...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_fixtures_league_date
      ON ts_fixtures(league_id, match_date DESC)
      WHERE status_id IS NOT NULL
    `);

    // 4. Fixtures - Optimize date range queries (calendar view)
    logger.info('[Migration PR-P1D] Creating idx_ts_fixtures_date_status...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_fixtures_date_status
      ON ts_fixtures(match_date, status_id)
      WHERE match_date >= CURRENT_DATE - INTERVAL '7 days'
    `);

    // 5. Fixtures - Optimize team recent form queries
    logger.info('[Migration PR-P1D] Creating idx_ts_fixtures_home_team_date...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_fixtures_home_team_date
      ON ts_fixtures(home_team_id, match_date DESC)
      WHERE status_id = 8
    `);

    logger.info('[Migration PR-P1D] Creating idx_ts_fixtures_away_team_date...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_fixtures_away_team_date
      ON ts_fixtures(away_team_id, match_date DESC)
      WHERE status_id = 8
    `);

    // 6. Customer Predictions - Optimize user prediction history
    logger.info('[Migration PR-P1D] Creating idx_customer_predictions_user_match...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_predictions_user_match
      ON customer_predictions(customer_user_id, match_id)
    `);

    // 7. Customer Predictions - Optimize match predictions leaderboard
    logger.info('[Migration PR-P1D] Creating idx_customer_predictions_match_created...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_predictions_match_created
      ON customer_predictions(match_id, created_at DESC)
    `);

    // 8. Standings - Optimize league standings queries
    logger.info('[Migration PR-P1D] Creating idx_ts_standings_league_season...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_standings_league_season
      ON ts_standings(league_id, season_id, position)
    `);

    // 9. Standings - Optimize team standings lookup
    logger.info('[Migration PR-P1D] Creating idx_ts_standings_team...');
    await client.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ts_standings_team
      ON ts_standings(team_id, league_id, season_id)
    `);

    logger.info('[Migration PR-P1D] ✅ All hot path indexes created successfully');
  } catch (error: any) {
    logger.error('[Migration PR-P1D] Failed to create indexes:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    logger.info('[Migration PR-P1D] Dropping hot path indexes...');

    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_players_team_position');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_players_position');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_fixtures_league_date');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_fixtures_date_status');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_fixtures_home_team_date');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_fixtures_away_team_date');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_customer_predictions_user_match');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_customer_predictions_match_created');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_standings_league_season');
    await client.query('DROP INDEX CONCURRENTLY IF EXISTS idx_ts_standings_team');

    logger.info('[Migration PR-P1D] ✅ All hot path indexes dropped');
  } catch (error: any) {
    logger.error('[Migration PR-P1D] Failed to drop indexes:', error);
    throw error;
  } finally {
    client.release();
  }
}
