/**
 * Create ts_teams Table Migration
 * 
 * Creates the ts_teams table for storing team data from TheSports API
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function createTsTeamsTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Drop table if exists (for clean migration)
    await client.query('DROP TABLE IF EXISTS ts_teams CASCADE');

    // Create ts_teams table
    await client.query(`
      CREATE TABLE ts_teams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo_url TEXT,
        country_id VARCHAR(255),
        competition_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes (after table creation)
    await client.query(`
      CREATE INDEX idx_ts_teams_external_id ON ts_teams(external_id)
    `);

    await client.query(`
      CREATE INDEX idx_ts_teams_name ON ts_teams(name)
    `);

    await client.query(`
      CREATE INDEX idx_ts_teams_country_id ON ts_teams(country_id)
    `);

    await client.query(`
      CREATE INDEX idx_ts_teams_competition_id ON ts_teams(competition_id)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_teams table created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to create ts_teams table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  createTsTeamsTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

