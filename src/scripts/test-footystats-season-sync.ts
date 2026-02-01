// src/scripts/test-footystats-season-sync.ts
import dotenv from 'dotenv';
import { runFootyStatsSeasonStatsUpsert } from '../jobs/footyStatsLeagueSeasonStatsSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('='.repeat(80));
  console.log('FootyStats Season Stats Sync - Test Script');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test connection
    console.log('[1/3] Testing database connection...');
    const connTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connTest.rows[0].now);
    console.log('');

    // Run sync for fs_season_id = 14972
    console.log('[2/3] Fetching FootyStats data for fs_season_id=14972...');
    const result = await runFootyStatsSeasonStatsUpsert(14972);
    console.log('✅ Sync completed:', result);
    console.log('');

    // Verify data
    console.log('[3/3] Verifying data in fs_league_season_stats...');
    const verify = await pool.query(`
      SELECT
        fs_season_id,
        season_btts_percentage,
        season_over25_percentage,
        season_avg_goals_overall,
        corners_avg_overall,
        cards_avg_overall,
        source_hash,
        LENGTH(stats::text) as stats_size_bytes,
        fetched_at
      FROM fs_league_season_stats
      WHERE fs_season_id = 14972
    `);

    if (verify.rows.length > 0) {
      console.log('✅ Data found in database:');
      console.log(JSON.stringify(verify.rows[0], null, 2));
    } else {
      console.log('❌ No data found for fs_season_id=14972');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(80));
    console.error(error.stack);
    process.exit(1);
  }
}

main();
