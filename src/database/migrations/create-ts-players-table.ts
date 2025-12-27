/**
 * Create ts_players Table Migration
 * 
 * Creates the ts_players table for storing player data from TheSports API
 * High volume data - optimized for batch inserts
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function createTsPlayersTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create ts_players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        short_name VARCHAR(100),
        logo VARCHAR(500),
        team_id VARCHAR(255),
        country_id VARCHAR(255),
        age INTEGER,
        birthday BIGINT,
        height INTEGER,
        weight INTEGER,
        market_value BIGINT,
        market_value_currency VARCHAR(10),
        contract_until BIGINT,
        preferred_foot INTEGER,
        position VARCHAR(10),
        positions JSONB,
        ability JSONB,
        characteristics JSONB,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_external_id ON ts_players(external_id)
    `);

    // Critical index for querying squad by team
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_team_id ON ts_players(team_id)
    `);

    // Index for country lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_country_id ON ts_players(country_id)
    `);

    // Index for name searches
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_name ON ts_players(name)
    `);

    // GIN index for JSONB fields (for complex queries on positions, ability, characteristics)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_players_positions_gin ON ts_players USING GIN (positions)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_players table created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to create ts_players table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  createTsPlayersTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}










