/**
 * Migration: Add live match columns to ts_matches table
 * 
 * Adds columns for red cards, yellow cards, corners, and live kickoff time
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function addMatchLiveColumns(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add live match columns
    await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS home_red_cards INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_red_cards INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_yellow_cards INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_yellow_cards INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_corners INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_corners INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS live_kickoff_time BIGINT;
    `);

    // Create indexes for live queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_live_kickoff 
      ON ts_matches(live_kickoff_time) WHERE live_kickoff_time IS NOT NULL;
    `);

    await client.query('COMMIT');
    logger.info('✅ Live match columns added to ts_matches table successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to add live match columns to ts_matches table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  addMatchLiveColumns()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}










