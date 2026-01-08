/**
 * Backfill: Fill competition_id and country_id for existing predictions
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { pool } from '../connection';

async function backfill() {
  const client = await pool.connect();

  try {
    console.log('=== BACKFILLING PREDICTION LOCATION DATA ===\n');

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

    // Backfill with explicit type casts
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
        p.id,
        p.canonical_bot_name,
        p.league_name,
        p.competition_id,
        c.name as competition_name,
        p.country_id,
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

    console.log('\n✅ Backfill completed successfully!');

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(console.error);
