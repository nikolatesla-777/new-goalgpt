/**
 * Migration: Add competition_id and country_id to ai_predictions
 *
 * This enables:
 * - Country-level success rate breakdown per bot
 * - Competition-level success rate breakdown per bot
 * - More efficient filtering and analytics
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { pool } from '../connection';

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== ADDING LOCATION COLUMNS TO ai_predictions ===');

    // Add competition_id column
    await client.query(`
      ALTER TABLE ai_predictions
      ADD COLUMN IF NOT EXISTS competition_id VARCHAR(255)
    `);
    console.log('✓ competition_id column added');

    // Add country_id column
    await client.query(`
      ALTER TABLE ai_predictions
      ADD COLUMN IF NOT EXISTS country_id VARCHAR(255)
    `);
    console.log('✓ country_id column added');

    // Add indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_competition_id
      ON ai_predictions(competition_id)
    `);
    console.log('✓ competition_id index created');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_predictions_country_id
      ON ai_predictions(country_id)
    `);
    console.log('✓ country_id index created');

    // Backfill existing predictions from matched data
    console.log('\n=== BACKFILLING EXISTING PREDICTIONS ===');

    const backfillResult = await client.query(`
      UPDATE ai_predictions p
      SET
        competition_id = c.id::varchar,
        country_id = cnt.id::varchar
      FROM ts_matches m
      JOIN ts_competitions c ON m.competition_id::varchar = c.external_id::varchar
      LEFT JOIN ts_countries cnt ON c.country_id = cnt.external_id
      WHERE p.match_id::varchar = m.external_id::varchar
        AND (p.competition_id IS NULL OR p.country_id IS NULL)
    `);
    console.log(`✓ Backfilled ${backfillResult.rowCount} predictions`);

    // Verify columns
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ai_predictions'
      AND column_name IN ('competition_id', 'country_id')
      ORDER BY column_name
    `);

    console.log('\n=== NEW COLUMNS ===');
    result.rows.forEach((r: any) => {
      console.log(`- ${r.column_name}: ${r.data_type}`);
    });

    // Show stats
    const statsResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(competition_id) as with_competition,
        COUNT(country_id) as with_country
      FROM ai_predictions
    `);
    const stats = statsResult.rows[0];
    console.log(`\n=== COVERAGE ===`);
    console.log(`Total predictions: ${stats.total}`);
    console.log(`With competition_id: ${stats.with_competition}`);
    console.log(`With country_id: ${stats.with_country}`);

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
