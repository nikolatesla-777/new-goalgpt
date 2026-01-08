/**
 * Migration: Add half statistics persistence columns to ts_matches
 *
 * This migration adds columns for:
 * - statistics_second_half: Stats snapshot for second half only
 * - incidents_first_half: Events that occurred in first half (minute <= 45)
 * - incidents_second_half: Events that occurred in second half (minute > 45)
 * - data_completeness: Tracking which data has been fully captured
 *
 * Note: first_half_stats column already exists from previous migration
 * The existing 'statistics' column = full time (entire match)
 * The existing 'incidents' column = full time (entire match)
 */

import { Pool } from 'pg';

export async function up(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('Starting half statistics persistence migration...');

    // 1. Add statistics_second_half column
    const checkSecondHalf = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches'
      AND column_name = 'statistics_second_half'
    `);

    if (checkSecondHalf.rows.length === 0) {
      await client.query(`
        ALTER TABLE ts_matches
        ADD COLUMN statistics_second_half JSONB DEFAULT NULL
      `);
      console.log('✅ Added statistics_second_half column to ts_matches');
    } else {
      console.log('⏭️ statistics_second_half column already exists, skipping');
    }

    // 2. Add incidents_first_half column
    const checkIncidentsFirst = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches'
      AND column_name = 'incidents_first_half'
    `);

    if (checkIncidentsFirst.rows.length === 0) {
      await client.query(`
        ALTER TABLE ts_matches
        ADD COLUMN incidents_first_half JSONB DEFAULT '[]'
      `);
      console.log('✅ Added incidents_first_half column to ts_matches');
    } else {
      console.log('⏭️ incidents_first_half column already exists, skipping');
    }

    // 3. Add incidents_second_half column
    const checkIncidentsSecond = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches'
      AND column_name = 'incidents_second_half'
    `);

    if (checkIncidentsSecond.rows.length === 0) {
      await client.query(`
        ALTER TABLE ts_matches
        ADD COLUMN incidents_second_half JSONB DEFAULT '[]'
      `);
      console.log('✅ Added incidents_second_half column to ts_matches');
    } else {
      console.log('⏭️ incidents_second_half column already exists, skipping');
    }

    // 4. Add data_completeness tracking column
    const checkCompleteness = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches'
      AND column_name = 'data_completeness'
    `);

    if (checkCompleteness.rows.length === 0) {
      await client.query(`
        ALTER TABLE ts_matches
        ADD COLUMN data_completeness JSONB DEFAULT '{"first_half": false, "second_half": false, "full_time": false}'
      `);
      console.log('✅ Added data_completeness column to ts_matches');
    } else {
      console.log('⏭️ data_completeness column already exists, skipping');
    }

    // 5. Create index for querying incomplete matches
    const checkIndex = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'ts_matches'
      AND indexname = 'idx_ts_matches_data_completeness'
    `);

    if (checkIndex.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_ts_matches_data_completeness
        ON ts_matches USING GIN (data_completeness)
      `);
      console.log('✅ Created index on data_completeness column');
    } else {
      console.log('⏭️ data_completeness index already exists, skipping');
    }

    console.log('✅ Half statistics persistence migration completed successfully');

  } finally {
    client.release();
  }
}

export async function down(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    // Drop index first
    await client.query(`
      DROP INDEX IF EXISTS idx_ts_matches_data_completeness
    `);

    // Drop columns
    await client.query(`
      ALTER TABLE ts_matches
      DROP COLUMN IF EXISTS statistics_second_half
    `);
    await client.query(`
      ALTER TABLE ts_matches
      DROP COLUMN IF EXISTS incidents_first_half
    `);
    await client.query(`
      ALTER TABLE ts_matches
      DROP COLUMN IF EXISTS incidents_second_half
    `);
    await client.query(`
      ALTER TABLE ts_matches
      DROP COLUMN IF EXISTS data_completeness
    `);

    console.log('✅ Dropped half statistics persistence columns from ts_matches');
  } finally {
    client.release();
  }
}
