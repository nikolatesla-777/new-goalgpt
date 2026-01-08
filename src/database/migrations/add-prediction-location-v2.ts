/**
 * Migration: Add competition_id and country_id to ai_predictions (v2)
 * Fixed version with proper type handling
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { pool } from '../connection';

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== ADDING LOCATION COLUMNS TO ai_predictions ===\n');

    // Check if columns already exist
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ai_predictions'
      AND column_name IN ('competition_id', 'country_id')
    `);

    const existingColumns = checkResult.rows.map((r: any) => r.column_name);
    console.log('Existing columns:', existingColumns.length > 0 ? existingColumns.join(', ') : 'none');

    // Add competition_id column if not exists
    if (!existingColumns.includes('competition_id')) {
      await client.query(`
        ALTER TABLE ai_predictions
        ADD COLUMN competition_id VARCHAR(255)
      `);
      console.log('✓ competition_id column added');
    } else {
      console.log('✓ competition_id column already exists');
    }

    // Add country_id column if not exists
    if (!existingColumns.includes('country_id')) {
      await client.query(`
        ALTER TABLE ai_predictions
        ADD COLUMN country_id VARCHAR(255)
      `);
      console.log('✓ country_id column added');
    } else {
      console.log('✓ country_id column already exists');
    }

    // Add indexes
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

    await client.query('COMMIT');
    console.log('\n✅ Columns added successfully!');

    // Now do backfill in a separate transaction
    console.log('\n=== BACKFILLING EXISTING PREDICTIONS ===\n');

    // Check current state
    const beforeStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(competition_id) as with_competition,
        COUNT(country_id) as with_country
      FROM ai_predictions
    `);
    const before = beforeStats.rows[0];
    console.log('Before backfill:');
    console.log(`  Total predictions: ${before.total}`);
    console.log(`  With competition_id: ${before.with_competition}`);
    console.log(`  With country_id: ${before.with_country}`);

    // Backfill
    console.log('\nRunning backfill...');

    const backfillResult = await client.query(`
      UPDATE ai_predictions p
      SET
        competition_id = c.id::text,
        country_id = cnt.id::text
      FROM ts_matches m
      JOIN ts_competitions c ON m.competition_id = c.external_id
      LEFT JOIN ts_countries cnt ON c.country_id = cnt.id
      WHERE p.match_id = m.external_id
        AND p.match_id IS NOT NULL
        AND (p.competition_id IS NULL OR p.country_id IS NULL)
    `);
    console.log(`✓ Updated ${backfillResult.rowCount} predictions`);

    // Check after state
    const afterStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(competition_id) as with_competition,
        COUNT(country_id) as with_country
      FROM ai_predictions
    `);
    const after = afterStats.rows[0];
    console.log('\nAfter backfill:');
    console.log(`  Total predictions: ${after.total}`);
    console.log(`  With competition_id: ${after.with_competition}`);
    console.log(`  With country_id: ${after.with_country}`);

    // Show sample data
    const sampleResult = await client.query(`
      SELECT
        p.canonical_bot_name,
        c.name as competition_name,
        cnt.name as country_name
      FROM ai_predictions p
      LEFT JOIN ts_competitions c ON p.competition_id = c.id::text
      LEFT JOIN ts_countries cnt ON p.country_id = cnt.id::text
      WHERE p.competition_id IS NOT NULL
      LIMIT 5
    `);

    if (sampleResult.rows.length > 0) {
      console.log('\nSample backfilled predictions:');
      sampleResult.rows.forEach((r: any) => {
        console.log(`  - ${r.canonical_bot_name}: ${r.competition_name} (${r.country_name})`);
      });
    }

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
