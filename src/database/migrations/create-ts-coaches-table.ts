/**
 * Create ts_coaches Table Migration
 * 
 * Creates the ts_coaches table for storing coach/manager data from TheSports API
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function createTsCoachesTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create ts_coaches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_coaches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo VARCHAR(500),
        team_id VARCHAR(255),
        country_id VARCHAR(255),
        type INTEGER,
        birthday BIGINT,
        age INTEGER,
        preferred_formation VARCHAR(20),
        nationality VARCHAR(100),
        joined BIGINT,
        contract_until BIGINT,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_external_id ON ts_coaches(external_id)
    `);

    // Critical index for querying coach by team
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_team_id ON ts_coaches(team_id)
    `);

    // Index for country lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_country_id ON ts_coaches(country_id)
    `);

    // Index for name searches
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_coaches_name ON ts_coaches(name)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_coaches table created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to create ts_coaches table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  createTsCoachesTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}






