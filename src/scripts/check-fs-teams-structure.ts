import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'fs_teams'
      ORDER BY ordinal_position
    `);

    console.log('Current fs_teams columns:', result.rows.length);
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    // Check primary key
    const pkResult = await pool.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'fs_teams'::regclass AND i.indisprimary
    `);

    console.log('\nPrimary key columns:');
    pkResult.rows.forEach(row => console.log(`  ${row.attname}`));

    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
