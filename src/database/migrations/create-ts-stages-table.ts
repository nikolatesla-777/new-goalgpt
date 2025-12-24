/**
 * Create ts_stages Table Migration
 * 
 * Creates the ts_stages table for storing stage/tournament phase data from TheSports API
 * Crucial for distinguishing "Group Stage" vs "Finals"
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function createTsStagesTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create ts_stages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_stages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        season_id VARCHAR(255),
        name VARCHAR(255),
        mode INTEGER,
        group_count INTEGER,
        round_count INTEGER,
        sort_order INTEGER,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_stages_external_id ON ts_stages(external_id)
    `);

    // Index for season lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_stages_season_id ON ts_stages(season_id)
    `);

    // Index for ordering stages within a season
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_stages_season_order ON ts_stages(season_id, sort_order)
    `);

    // Index for mode filtering (League vs Cup)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_stages_mode ON ts_stages(mode)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_stages table created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to create ts_stages table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  createTsStagesTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

