import { pool } from '../database/connection';

async function main() {
  console.log('Checking fs_competitions_allowlist schema...\n');

  const schema = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'fs_competitions_allowlist'
    ORDER BY ordinal_position
  `);

  console.log('Columns:');
  schema.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  });

  console.log('\n\nSample data:');
  const sample = await pool.query('SELECT * FROM fs_competitions_allowlist LIMIT 3');
  console.log(sample.rows);

  await pool.end();
  process.exit(0);
}

main();
