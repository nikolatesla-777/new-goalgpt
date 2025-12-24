/**
 * Create ts_countries Table Migration
 * 
 * Creates the ts_countries table for storing country/region data from TheSports API
 * Note: category_id references ts_categories(external_id) but not as a formal FK constraint
 * to allow for flexibility during sync operations
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function createTsCountriesTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create ts_countries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_countries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        category_id VARCHAR(255),
        name VARCHAR(255),
        logo VARCHAR(500),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index on external_id for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_countries_external_id ON ts_countries(external_id)
    `);

    // Create index on category_id for joins with categories
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_countries_category_id ON ts_countries(category_id)
    `);

    // Create index on name for search
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_countries_name ON ts_countries(name)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_countries table created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to create ts_countries table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  createTsCountriesTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}






