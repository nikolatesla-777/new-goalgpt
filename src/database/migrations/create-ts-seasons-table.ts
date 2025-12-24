/**
 * Create ts_seasons Table Migration
 * 
 * Creates the ts_seasons table for storing season/timeline data from TheSports API
 * Critical for "Standings/Table" and filtering current matches
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function createTsSeasonsTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create ts_seasons table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_seasons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        competition_id VARCHAR(255),
        year VARCHAR(50),
        is_current BOOLEAN,
        has_table BOOLEAN,
        has_player_stats BOOLEAN,
        has_team_stats BOOLEAN,
        start_time BIGINT,
        end_time BIGINT,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_seasons_external_id ON ts_seasons(external_id)
    `);

    // Index for competition lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_seasons_competition_id ON ts_seasons(competition_id)
    `);

    // Composite index for fast lookup of active seasons by competition
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_seasons_competition_current ON ts_seasons(competition_id, is_current)
    `);

    // Index for current season lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_seasons_is_current ON ts_seasons(is_current)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_seasons table created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to create ts_seasons table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  createTsSeasonsTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}








