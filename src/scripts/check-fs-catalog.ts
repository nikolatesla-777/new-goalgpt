import { pool } from '../database/connection';

async function main() {
  console.log('Checking fs_competitions_catalog schema...\n');

  const schema = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'fs_competitions_catalog'
    ORDER BY ordinal_position
  `);

  console.log('Columns:');
  schema.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  });

  console.log('\n\nSample data:');
  const sample = await pool.query('SELECT * FROM fs_competitions_catalog LIMIT 5');
  console.log(sample.rows);

  console.log('\n\nChecking mapping with ts_competitions...');
  const mapping = await pool.query(`
    SELECT
      fc.id as fs_id,
      fc.name as fs_name,
      fc.thesports_id,
      tc.name as ts_name
    FROM fs_competitions_catalog fc
    LEFT JOIN ts_competitions tc ON fc.thesports_id = tc.external_id
    WHERE fc.thesports_id IS NOT NULL
    LIMIT 5
  `);

  console.log('Mapping sample:');
  mapping.rows.forEach(row => {
    console.log(`  FootyStats: ${row.fs_name} (${row.fs_id})`);
    console.log(`  TheSports: ${row.ts_name} (${row.thesports_id})`);
    console.log('');
  });

  await pool.end();
  process.exit(0);
}

main();
