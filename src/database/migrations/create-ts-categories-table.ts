/**
 * Create ts_categories Table Migration
 * 
 * Creates the ts_categories table for storing category (country/region) data from TheSports API
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function createTsCategoriesTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create ts_categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ts_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index on external_id for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_categories_external_id ON ts_categories(external_id)
    `);

    // Create index on name for search
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_categories_name ON ts_categories(name)
    `);

    await client.query('COMMIT');
    logger.info('✅ ts_categories table created successfully');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to create ts_categories table:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  createTsCategoriesTable()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}









