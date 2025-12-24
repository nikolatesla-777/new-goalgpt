import dotenv from 'dotenv';
import { pool } from './src/database/connection';

dotenv.config();

async function fixCompetitionsId() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check current column type
    const checkResult = await client.query(`
      SELECT data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'ts_competitions' AND column_name = 'id'
    `);
    
    const dataType = checkResult.rows[0]?.data_type;
    const currentDefault = checkResult.rows[0]?.column_default;
    console.log(`📋 Current id column type: ${dataType}`);
    console.log(`📋 Current default: ${currentDefault || 'NULL'}`);
    
    if (dataType === 'uuid') {
      // Set default UUID generation
      await client.query(`
        ALTER TABLE ts_competitions 
        ALTER COLUMN id SET DEFAULT gen_random_uuid()
      `);
      console.log('✅ Set default: gen_random_uuid()');
    } else if (dataType === 'integer' || dataType === 'bigint') {
      // Create sequence for integer IDs
      await client.query(`
        CREATE SEQUENCE IF NOT EXISTS ts_competitions_id_seq;
        ALTER TABLE ts_competitions 
        ALTER COLUMN id SET DEFAULT nextval('ts_competitions_id_seq')
      `);
      console.log('✅ Set default: nextval(ts_competitions_id_seq)');
    } else {
      throw new Error(`Unknown data type: ${dataType}`);
    }
    
    await client.query('COMMIT');
    console.log('✅ Schema fixed successfully!');
    
    // Verify
    const verifyResult = await client.query(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_name = 'ts_competitions' AND column_name = 'id'
    `);
    console.log('✅ Verified default:', verifyResult.rows[0]?.column_default);
    
    process.exit(0);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixCompetitionsId();







