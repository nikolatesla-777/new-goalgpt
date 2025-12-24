/**
 * Migration: Rename 'order' column to 'sort_order' in ts_stages table
 * 
 * Fixes SQL syntax error: "order" is a reserved keyword in SQL
 * This migration renames the column to avoid conflicts
 */

import { pool } from '../connection';
import { logger } from '../../utils/logger';

export async function renameOrderToSortOrderInStages(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if column 'order' exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ts_stages' AND column_name = 'order'
    `);

    if (columnCheck.rows.length > 0) {
      // Rename the column
      await client.query(`
        ALTER TABLE ts_stages 
        RENAME COLUMN "order" TO sort_order
      `);

      logger.info('✅ Renamed column "order" to "sort_order" in ts_stages table');
    } else {
      logger.info('ℹ️ Column "order" does not exist, skipping rename');
    }

    // Drop old index if it exists
    try {
      await client.query(`
        DROP INDEX IF EXISTS idx_ts_stages_season_order
      `);
    } catch (error: any) {
      // Index might not exist, ignore
      logger.debug('Index idx_ts_stages_season_order does not exist or already dropped');
    }

    // Recreate index with new column name
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ts_stages_season_order 
      ON ts_stages(season_id, sort_order)
    `);

    await client.query('COMMIT');
    logger.info('✅ Migration completed: order -> sort_order');
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('❌ Failed to rename order column:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  renameOrderToSortOrderInStages()
    .then(() => {
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}







