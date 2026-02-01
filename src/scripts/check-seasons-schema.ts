import { pool } from '../database/connection';

async function main() {
  console.log('Checking ts_seasons table schema...\n');

  const res = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'ts_seasons'
    ORDER BY ordinal_position
  `);

  console.log('Columns:');
  res.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
  });

  console.log('\n\nSample data:');
  const sample = await pool.query('SELECT * FROM ts_seasons LIMIT 3');
  console.log(sample.rows);

  await pool.end();
  process.exit(0);
}

main();
