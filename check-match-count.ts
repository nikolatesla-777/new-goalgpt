/**
 * Direct database query to check match count for TSI January 20, 2026
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

// TSI (UTC+3) day boundaries for January 20, 2026
// TSI 2026-01-20 00:00:00 = UTC 2026-01-19 21:00:00 = Unix 1768856400
// TSI 2026-01-20 23:59:59 = UTC 2026-01-20 20:59:59 = Unix 1768942799
const TSI_DAY_START = 1768856400;
const TSI_DAY_END = 1768942799;

async function checkMatchCount() {
  try {
    console.log('🔍 Checking match count for TSI 2026-01-20...\n');
    console.log(`TSI Boundaries:`);
    console.log(`  Start: ${new Date(TSI_DAY_START * 1000).toISOString()} (Unix: ${TSI_DAY_START})`);
    console.log(`  End:   ${new Date(TSI_DAY_END * 1000).toISOString()} (Unix: ${TSI_DAY_END})\n`);

    // Query 1: Total count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
    `, [TSI_DAY_START, TSI_DAY_END]);

    console.log(`📊 Total matches: ${countResult.rows[0].total}\n`);

    // Query 2: Count by status
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

    // Query 3: Sample of matches (first 5)
    const sampleResult = await pool.query(`
      SELECT
        external_id,
        match_time,
        status_id,
        home_team_id,
        away_team_id,
        home_score_display,
        away_score_display,
        TO_CHAR(TO_TIMESTAMP(match_time), 'YYYY-MM-DD HH24:MI:SS TZ') as match_time_formatted
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
      ORDER BY match_time
      LIMIT 5
    `, [TSI_DAY_START, TSI_DAY_END]);

    console.log(`\n📋 Sample matches (first 5):`);
    for (const match of sampleResult.rows) {
      console.log(`  Match ${match.external_id}: Status ${match.status_id}, Time: ${match.match_time_formatted}`);
    }

    await pool.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkMatchCount();
