/**
 * Check when matches were last updated
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

const TSI_DAY_START = 1768856400;
const TSI_DAY_END = 1768942799;

async function checkLastUpdate() {
  try {
    console.log('🕒 Checking when matches were last updated...\n');

    // Get update timestamps
    const result = await pool.query(`
      SELECT
        MIN(updated_at) as first_update,
        MAX(updated_at) as last_update,
        MAX(external_updated_at) as last_external_update,
        COUNT(*) as total
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
    `, [TSI_DAY_START, TSI_DAY_END]);

    const row = result.rows[0];

    console.log(`📊 Update Statistics:`);
    console.log(`  Total matches: ${row.total}`);
    console.log(`  First updated: ${row.first_update?.toISOString() || 'N/A'}`);
    console.log(`  Last updated: ${row.last_update?.toISOString() || 'N/A'}`);
    console.log(`  Last external update (from API): ${row.last_external_update ? new Date(row.last_external_update * 1000).toISOString() : 'N/A'}`);

    // Current time
    const now = new Date();
    console.log(`  Current time: ${now.toISOString()}`);

    if (row.last_update) {
      const timeSinceUpdate = now.getTime() - row.last_update.getTime();
      const minutesAgo = Math.floor(timeSinceUpdate / 1000 / 60);
      console.log(`  Time since last update: ${minutesAgo} minutes ago`);
    }

    await pool.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkLastUpdate();
