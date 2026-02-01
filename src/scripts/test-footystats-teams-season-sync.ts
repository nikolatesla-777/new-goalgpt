// src/scripts/test-footystats-teams-season-sync.ts
import dotenv from 'dotenv';
import { runFootyStatsTeamsSeasonSync } from '../jobs/footyStatsTeamsSeasonSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('='.repeat(80));
  console.log('FootyStats Teams Season Sync - Test Script');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test connection
    console.log('[1/4] Testing database connection...');
    const connTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connTest.rows[0].now);
    console.log('');

    // Run sync for fs_season_id = 14972
    console.log('[2/4] Fetching FootyStats teams data for fs_season_id=14972...');
    const result = await runFootyStatsTeamsSeasonSync(14972);
    console.log('✅ Sync completed:', result);
    console.log('');

    // Verify teams
    console.log('[3/4] Verifying teams in fs_teams...');
    const teamsCount = await pool.query(`
      SELECT COUNT(*) as count FROM fs_teams
    `);
    console.log(`✅ Total teams in fs_teams: ${teamsCount.rows[0].count}`);
    console.log('');

    // Verify team seasons
    console.log('[4/4] Verifying team seasons for fs_season_id=14972...');
    const teamSeasonsQuery = await pool.query(`
      SELECT
        COUNT(*) as total_teams,
        COUNT(DISTINCT ts.fs_team_id) as unique_teams,
        SUM(CASE WHEN tss.stats IS NOT NULL THEN 1 ELSE 0 END) as teams_with_stats
      FROM fs_team_seasons ts
      LEFT JOIN fs_team_season_stats tss ON ts.fs_team_id = tss.fs_team_id AND ts.fs_season_id = tss.fs_season_id
      WHERE ts.fs_season_id = 14972
    `);

    const seasonStats = teamSeasonsQuery.rows[0];
    console.log('✅ Team seasons for fs_season_id=14972:');
    console.log(`   Total: ${seasonStats.total_teams}`);
    console.log(`   Unique teams: ${seasonStats.unique_teams}`);
    console.log(`   Teams with stats: ${seasonStats.teams_with_stats}`);
    console.log('');

    // Sample team data
    console.log('Sample team data (first 3):');
    const sampleTeams = await pool.query(`
      SELECT
        t.fs_team_id,
        t.country,
        ts.season,
        tss.season_btts_percentage_overall,
        tss.season_over25_percentage_overall,
        tss.season_ppg_overall,
        tss.corners_avg_overall,
        tss.cards_avg_overall,
        LEFT(tss.source_hash, 16) || '...' as hash_preview,
        LENGTH(tss.stats::text) as stats_size_bytes
      FROM fs_teams t
      JOIN fs_team_seasons ts ON t.fs_team_id = ts.fs_team_id
      JOIN fs_team_season_stats tss ON t.fs_team_id = tss.fs_team_id AND ts.fs_season_id = tss.fs_season_id
      WHERE ts.fs_season_id = 14972
      ORDER BY tss.season_ppg_overall DESC NULLS LAST
      LIMIT 3
    `);

    sampleTeams.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. Team ${row.fs_team_id} (${row.country}):`);
      console.log(`   Season: ${row.season}`);
      console.log(`   BTTS: ${row.season_btts_percentage_overall}%`);
      console.log(`   O2.5: ${row.season_over25_percentage_overall}%`);
      console.log(`   PPG: ${row.season_ppg_overall}`);
      console.log(`   Corners AVG: ${row.corners_avg_overall}`);
      console.log(`   Cards AVG: ${row.cards_avg_overall}`);
      console.log(`   Hash: ${row.hash_preview}`);
      console.log(`   Stats size: ${row.stats_size_bytes} bytes`);
    });

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
