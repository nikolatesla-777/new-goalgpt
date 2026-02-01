import { pool } from '../database/connection';

async function main() {
  console.log('Searching for Turkish leagues...\n');

  const result = await pool.query(`
    SELECT external_id, name
    FROM ts_competitions
    WHERE name LIKE '%Turkey%' OR name LIKE '%Turkish%' OR name LIKE '%Türk%'
    ORDER BY name
  `);

  console.log(`Found ${result.rows.length} Turkish leagues:\n`);

  result.rows.forEach((row, idx) => {
    console.log(`${idx + 1}. ${row.name}`);
    console.log(`   ID: ${row.external_id}\n`);
  });

  await pool.end();
  process.exit(0);
}

main();
