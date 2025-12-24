/**
 * Migration: Add statistics column to ts_matches table
 * 
 * Adds a JSONB column to store match statistics (possession, shots, corners, etc.)
 * Note: Stats are only available for popular competitions
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function addStatisticsColumnToTsMatches(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add statistics JSONB column
    await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS statistics JSONB;
    `);

    // Create index for JSONB queries (optional, but useful for filtering)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_statistics 
      ON ts_matches USING GIN (statistics);
    `);

    await client.query('COMMIT');
    logger.info('✅ statistics column added to ts_matches table successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to add statistics column to ts_matches table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  addStatisticsColumnToTsMatches()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}







