/**
 * Migration: Add score columns to ts_matches table
 * 
 * Adds separate columns for regular_score, overtime_score, and penalty_score
 * to prevent double counting and enable correct display score calculation
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function addScoreColumnsToTsMatches(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add score columns
    await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS home_score_regular INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_score_overtime INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_score_penalties INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_regular INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_overtime INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_penalties INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS home_score_display INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS away_score_display INTEGER DEFAULT 0;
    `);

    // Create indexes for score queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_score_display 
      ON ts_matches(home_score_display, away_score_display);
    `);

    await client.query('COMMIT');
    logger.info('✅ Score columns added to ts_matches table successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to add score columns to ts_matches table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  addScoreColumnsToTsMatches()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}









