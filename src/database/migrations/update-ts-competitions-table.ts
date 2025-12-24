/**
 * Update ts_competitions Table Migration
 * 
 * Adds missing columns for full competition data from TheSports API
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function updateTsCompetitionsTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add missing columns if they don't exist
    await client.query(`
      ALTER TABLE ts_competitions
      ADD COLUMN IF NOT EXISTS short_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS type INTEGER,
      ADD COLUMN IF NOT EXISTS category_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS cur_season_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS cur_stage_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS primary_color VARCHAR(50),
      ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(50)
    `);

    // Update logo column to VARCHAR(500) if it's TEXT
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'ts_competitions' 
          AND column_name = 'logo_url' 
          AND data_type = 'text'
        ) THEN
          ALTER TABLE ts_competitions ALTER COLUMN logo_url TYPE VARCHAR(500);
        END IF;
      END $$;
    `);

    // Create index on category_id for joins
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_competitions_category_id ON ts_competitions(category_id)
    `);

    // Create index on type for filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_competitions_type ON ts_competitions(type)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_competitions table updated successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to update ts_competitions table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  updateTsCompetitionsTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}






