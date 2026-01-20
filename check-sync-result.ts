/**
 * Check what was actually synced in the last run
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

async function checkSyncResult() {
  try {
    console.log('🔍 Checking sync results...\n');

    // Query 1: Total matches in TSI 20 Ocak range
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
    `, [TSI_DAY_START, TSI_DAY_END]);

    console.log(`📊 Total matches in TSI range: ${totalResult.rows[0].total}`);

    // Query 2: Recently updated matches (last 30 minutes)
    const recentUpdateTime = new Date(Date.now() - 30 * 60 * 1000);
    const recentResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
        AND updated_at >= $3
    `, [TSI_DAY_START, TSI_DAY_END, recentUpdateTime]);

    console.log(`🔄 Recently updated (last 30 min): ${recentResult.rows[0].total}`);

    // Query 3: Check for matches OUTSIDE TSI range that were updated
    const outsideResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM ts_matches
      WHERE (match_time < $1 OR match_time > $2)
        AND updated_at >= $3
    `, [TSI_DAY_START, TSI_DAY_END, recentUpdateTime]);

    console.log(`📊 Matches OUTSIDE TSI range but updated: ${outsideResult.rows[0].total}`);

    // Query 4: Sample matches to see their timestamps
    const sampleResult = await pool.query(`
      SELECT
        external_id,
        match_time,
        TO_TIMESTAMP(match_time) AT TIME ZONE 'UTC' as match_time_utc,
        updated_at
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
      ORDER BY match_time
      LIMIT 10
    `, [TSI_DAY_START, TSI_DAY_END]);

    console.log(`\n📋 Sample matches (first 10):`);
    for (const match of sampleResult.rows) {
      console.log(`  ${match.external_id}: ${match.match_time_utc.toISOString()}`);
    }

    // Query 5: Check exact match_time distribution
    const distributionResult = await pool.query(`
      SELECT
        DATE_TRUNC('hour', TO_TIMESTAMP(match_time) AT TIME ZONE 'UTC' + INTERVAL '3 hours') as tsi_hour,
        COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 AND match_time <= $2
      GROUP BY tsi_hour
      ORDER BY tsi_hour
      LIMIT 30
    `, [TSI_DAY_START, TSI_DAY_END]);

    console.log(`\n📊 Match distribution by TSI hour:`);
    for (const row of distributionResult.rows) {
      console.log(`  ${row.tsi_hour.toISOString().split('T')[1].split('.')[0]}: ${row.count} matches`);
    }

    await pool.end();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkSyncResult();
