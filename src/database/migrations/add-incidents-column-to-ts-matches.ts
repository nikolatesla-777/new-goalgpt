/**
 * Migration: Add incidents column to ts_matches table
 * 
 * Adds a JSONB column to store match incidents (goals, cards, VAR, etc.)
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function addIncidentsColumnToTsMatches(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add incidents JSONB column
    await client.query(`
      ALTER TABLE ts_matches
      ADD COLUMN IF NOT EXISTS incidents JSONB;
    `);

    // Create index for JSONB queries (optional, but useful for filtering)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_matches_incidents 
      ON ts_matches USING GIN (incidents);
    `);

    await client.query('COMMIT');
    logger.info('✅ incidents column added to ts_matches table successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to add incidents column to ts_matches table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  addIncidentsColumnToTsMatches()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}










