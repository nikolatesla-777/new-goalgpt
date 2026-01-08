/**
 * Script to run the half statistics persistence migration
 *
 * Usage: npx ts-node src/scripts/run-half-stats-migration.ts
 */

import { pool } from '../database/connection';
import { up } from '../database/migrations/add-half-statistics-persistence';

async function main() {
  console.log('========================================');
  console.log('Running Half Statistics Persistence Migration');
  console.log('========================================');

  try {
    await up(pool);
    console.log('\n✅ Migration completed successfully!');

    // Verify the columns exist
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'ts_matches'
      AND column_name IN (
        'first_half_stats',
        'statistics_second_half',
        'incidents_first_half',
        'incidents_second_half',
        'data_completeness'
      )
      ORDER BY column_name
    `);

    console.log('\n📊 Current half statistics columns in ts_matches:');
    console.table(result.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
