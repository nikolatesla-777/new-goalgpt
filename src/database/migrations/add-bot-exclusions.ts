/**
 * Migration: Add exclusion columns to ai_bot_rules
 *
 * Adds:
 * - excluded_countries: Array of country IDs to exclude
 * - excluded_competitions: Array of competition IDs to exclude
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { pool } from '../connection';

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== ADDING EXCLUSION COLUMNS TO ai_bot_rules ===');

    // Add excluded_countries column
    await client.query(`
      ALTER TABLE ai_bot_rules
      ADD COLUMN IF NOT EXISTS excluded_countries TEXT[] DEFAULT '{}'
    `);
    console.log('✓ excluded_countries column added');

    // Add excluded_competitions column
    await client.query(`
      ALTER TABLE ai_bot_rules
      ADD COLUMN IF NOT EXISTS excluded_competitions TEXT[] DEFAULT '{}'
    `);
    console.log('✓ excluded_competitions column added');

    // Verify columns
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_bot_rules'
      ORDER BY ordinal_position
    `);

    console.log('\n=== ai_bot_rules TABLE STRUCTURE ===');
    result.rows.forEach((r: any) => {
      console.log(`- ${r.column_name}: ${r.data_type}`);
    });

    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
