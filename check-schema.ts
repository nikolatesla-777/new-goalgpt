import dotenv from 'dotenv';
import { pool } from './src/database/connection';

dotenv.config();

async function checkSchema() {
  const client = await pool.connect();
  try {
    // Check id column definition
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'ts_matches' AND column_name = 'id'
    `);
    
    console.log('📋 ts_matches.id column definition:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    // Check if there's a default UUID generation
    if (result.rows[0]?.column_default) {
      console.log('\n✅ ID has default:', result.rows[0].column_default);
    } else {
      console.log('\n❌ ID has NO default - this is the problem!');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();






