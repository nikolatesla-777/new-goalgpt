/**
 * Migration: Add Field Metadata Tracking
 *
 * Purpose: Add _source and _timestamp columns for critical fields
 * to enable field-level conflict resolution in LiveMatchOrchestrator.
 *
 * Fields tracked:
 * - home_score
 * - away_score
 * - minute
 * - status_id
 *
 * Each field gets:
 * - {field}_source: VARCHAR(20) - 'api' | 'mqtt' | 'computed' | 'watchdog'
 * - {field}_timestamp: BIGINT - Unix timestamp of last update
 *
 * @migration add-field-metadata
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function up(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('[Migration] Adding field metadata columns...');

    // Add metadata columns for critical fields
    await client.query(`
      ALTER TABLE ts_matches
        ADD COLUMN IF NOT EXISTS home_score_source VARCHAR(20),
        ADD COLUMN IF NOT EXISTS home_score_timestamp BIGINT,
        ADD COLUMN IF NOT EXISTS away_score_source VARCHAR(20),
        ADD COLUMN IF NOT EXISTS away_score_timestamp BIGINT,
        ADD COLUMN IF NOT EXISTS minute_source VARCHAR(20),
        ADD COLUMN IF NOT EXISTS minute_timestamp BIGINT,
        ADD COLUMN IF NOT EXISTS status_id_source VARCHAR(20),
        ADD COLUMN IF NOT EXISTS status_id_timestamp BIGINT
    `);

    logger.info('[Migration] Field metadata columns added');

    // Backfill _source columns with default 'api' for existing data
    logger.info('[Migration] Backfilling source columns...');

    await client.query(`
      UPDATE ts_matches
      SET
        home_score_source = 'api',
        away_score_source = 'api',
        minute_source = CASE WHEN minute IS NOT NULL THEN 'computed' ELSE NULL END,
        status_id_source = 'api'
      WHERE home_score_source IS NULL
    `);

    logger.info('[Migration] Source columns backfilled');

    // Backfill _timestamp columns from provider_update_time or current time
    logger.info('[Migration] Backfilling timestamp columns...');

    await client.query(`
      UPDATE ts_matches
      SET
        home_score_timestamp = COALESCE(provider_update_time, EXTRACT(EPOCH FROM updated_at)::BIGINT),
        away_score_timestamp = COALESCE(provider_update_time, EXTRACT(EPOCH FROM updated_at)::BIGINT),
        minute_timestamp = COALESCE(last_minute_update_ts, EXTRACT(EPOCH FROM updated_at)::BIGINT),
        status_id_timestamp = COALESCE(provider_update_time, EXTRACT(EPOCH FROM updated_at)::BIGINT)
      WHERE home_score_timestamp IS NULL
    `);

    logger.info('[Migration] Timestamp columns backfilled');

    // Create indexes for performance
    logger.info('[Migration] Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_home_score_timestamp
      ON ts_matches(home_score_timestamp)
      WHERE status_id IN (2, 3, 4, 5, 7)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_minute_timestamp
      ON ts_matches(minute_timestamp)
      WHERE status_id IN (2, 3, 4, 5, 7)
    `);

    logger.info('[Migration] Indexes created');

    await client.query('COMMIT');

    logger.info('[Migration] ✅ Field metadata migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[Migration] ❌ Field metadata migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('[Migration] Rolling back field metadata columns...');

    // Drop indexes
    await client.query('DROP INDEX IF EXISTS idx_ts_matches_home_score_timestamp');
    await client.query('DROP INDEX IF EXISTS idx_ts_matches_minute_timestamp');

    // Drop columns
    await client.query(`
      ALTER TABLE ts_matches
        DROP COLUMN IF EXISTS home_score_source,
        DROP COLUMN IF EXISTS home_score_timestamp,
        DROP COLUMN IF EXISTS away_score_source,
        DROP COLUMN IF EXISTS away_score_timestamp,
        DROP COLUMN IF EXISTS minute_source,
        DROP COLUMN IF EXISTS minute_timestamp,
        DROP COLUMN IF EXISTS status_id_source,
        DROP COLUMN IF EXISTS status_id_timestamp
    `);

    await client.query('COMMIT');

    logger.info('[Migration] ✅ Field metadata rollback completed');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[Migration] ❌ Field metadata rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Allow direct execution for testing
if (require.main === module) {
  up()
    .then(() => {
      logger.info('[Migration] Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Migration] Migration failed:', error);
      process.exit(1);
    });
}
