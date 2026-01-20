/**
 * Check match count for TSI January 21, 2026
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

// TSI 2026-01-21 boundaries
// TSI 2026-01-21 00:00:00 = UTC 2026-01-20 21:00:00 = Unix 1768942800
// TSI 2026-01-21 23:59:59 = UTC 2026-01-21 20:59:59 = Unix 1769029199
const TSI_DAY_START = 1768942800;
const TSI_DAY_END = 1769029199;

async function checkMatchCount() {
  try {
    console.log('🔍 Checking match count for TSI 2026-01-21...\n');
    console.log(`TSI Boundaries:`);
    console.log(`  Start: ${new Date(TSI_DAY_START * 1000).toISOString()} (Unix: ${TSI_DAY_START})`);
    console.log(`  End:   ${new Date(TSI_DAY_END * 1000).toISOString()} (Unix: ${TSI_DAY_END})\n`);

    // Query: Total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
    `, [TSI_DAY_START, TSI_DAY_END]);

    console.log(`📊 Total matches: ${countResult.rows[0].total}\n`);

    // Count by status
    const statusResult = await pool.query(`
      SELECT
        status_id,
        COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
      GROUP BY status_id
      ORDER BY status_id
    `, [TSI_DAY_START, TSI_DAY_END]);

    console.log(`📈 Matches by status:`);
    const statusNames: Record<number, string> = {
      1: 'NOT_STARTED',
      2: 'FIRST_HALF',
      3: 'HALF_TIME',
      4: 'SECOND_HALF',
      5: 'OVERTIME',
      7: 'PENALTY',
      8: 'ENDED',
      9: 'POSTPONED',
      10: 'CANCELLED',
    };

    for (const row of statusResult.rows) {
      const statusName = statusNames[row.status_id] || `UNKNOWN(${row.status_id})`;
      console.log(`  ${statusName}: ${row.count} matches`);
    }

    await pool.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkMatchCount();
