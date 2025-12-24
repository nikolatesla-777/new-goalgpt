/**
 * Update ts_teams Table Migration
 * 
 * Adds missing columns for full team data from TheSports API
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function updateTsTeamsTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add missing columns if they don't exist
    await client.query(`
      ALTER TABLE ts_teams
      ADD COLUMN IF NOT EXISTS competition_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS website VARCHAR(500),
      ADD COLUMN IF NOT EXISTS national BOOLEAN,
      ADD COLUMN IF NOT EXISTS foundation_time INTEGER,
      ADD COLUMN IF NOT EXISTS venue_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS coach_id VARCHAR(255)
    `);

    // Update logo_url column to VARCHAR(500) if it's TEXT
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'ts_teams' 
          AND column_name = 'logo_url' 
          AND data_type = 'text'
        ) THEN
          ALTER TABLE ts_teams ALTER COLUMN logo_url TYPE VARCHAR(500);
        END IF;
      END $$;
    `);

    // Ensure id has default value
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'ts_teams' 
          AND column_name = 'id' 
          AND column_default IS NOT NULL
        ) THEN
          ALTER TABLE ts_teams ALTER COLUMN id SET DEFAULT gen_random_uuid();
        END IF;
      END $$;
    `);

    // Ensure external_id is NOT NULL
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'ts_teams' 
          AND column_name = 'external_id' 
          AND is_nullable = 'YES'
        ) THEN
          ALTER TABLE ts_teams ALTER COLUMN external_id SET NOT NULL;
        END IF;
      END $$;
    `);

    // Create index on competition_id if it doesn't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_teams_competition_id ON ts_teams(competition_id)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_teams table updated successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to update ts_teams table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  updateTsTeamsTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}








