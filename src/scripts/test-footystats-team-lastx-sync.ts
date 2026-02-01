// src/scripts/test-footystats-team-lastx-sync.ts
import dotenv from 'dotenv';
import { runFootyStatsTeamLastXSync } from '../jobs/footyStatsTeamLastXSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('='.repeat(80));
  console.log('FootyStats Team LastX Sync - Test Script');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test connection
    console.log('[1/6] Testing database connection...');
    const connTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connTest.rows[0].now);
    console.log('');

    // Get competition_id from fs_matches
    console.log('[2/6] Getting competition_id from fs_matches...');
    const compResult = await pool.query(`
      SELECT DISTINCT competition_id
      FROM fs_matches
      WHERE competition_id IS NOT NULL
      LIMIT 1
    `);

    if (compResult.rows.length === 0) {
      console.log('❌ No matches found in fs_matches');
      process.exit(1);
    }

    const competitionId = compResult.rows[0].competition_id;
    console.log(`✅ Using competition_id=${competitionId}`);
    console.log('');

    // Count unique teams before sync
    console.log('[3/6] Counting unique teams in fs_matches...');
    const teamCountResult = await pool.query(`
      WITH team_ids AS (
        SELECT DISTINCT unnest(ARRAY[home_team_fs_id, away_team_fs_id]) AS team_id
        FROM fs_matches
        WHERE competition_id = $1
          AND home_team_fs_id IS NOT NULL
          AND away_team_fs_id IS NOT NULL
      )
      SELECT COUNT(*) as team_count FROM team_ids
    `, [competitionId]);
    const teamCount = teamCountResult.rows[0].team_count;
    console.log(`✅ Found ${teamCount} unique teams to sync`);
    console.log('');

    // Run sync
    console.log('[4/6] Running FootyStats team LastX sync...');
    console.log('⏳ This may take a while (3 records per team, TTL cache enabled)...');
    const result = await runFootyStatsTeamLastXSync(competitionId, false, 5);
    console.log('✅ Sync completed:', result);
    console.log('');

    // Verify results
    console.log('[5/6] Verifying synced LastX data...');
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT team_id) as unique_teams,
        COUNT(CASE WHEN last_x = 5 THEN 1 END) as last5_count,
        COUNT(CASE WHEN last_x = 6 THEN 1 END) as last6_count,
        COUNT(CASE WHEN last_x = 10 THEN 1 END) as last10_count,
        COUNT(CASE WHEN scope = 0 THEN 1 END) as overall_count,
        COUNT(CASE WHEN scope = 1 THEN 1 END) as home_count,
        COUNT(CASE WHEN scope = 2 THEN 1 END) as away_count,
        AVG(LENGTH(stats::text)) as avg_stats_size,
        MIN(fetched_at) as first_fetch,
        MAX(fetched_at) as last_fetch
      FROM fs_team_lastx_stats
      WHERE competition_id = $1
    `, [competitionId]);

    const verify = verifyResult.rows[0];

    console.log(`✅ LastX Statistics (competition_id=${competitionId}):`);
    console.log(`   Total records: ${verify.total_records}`);
    console.log(`   Unique teams: ${verify.unique_teams}`);
    console.log('');
    console.log(`   Window breakdown:`);
    console.log(`     Last 5: ${verify.last5_count}`);
    console.log(`     Last 6: ${verify.last6_count}`);
    console.log(`     Last 10: ${verify.last10_count}`);
    console.log('');
    console.log(`   Scope breakdown:`);
    console.log(`     Overall: ${verify.overall_count}`);
    console.log(`     Home: ${verify.home_count}`);
    console.log(`     Away: ${verify.away_count}`);
    console.log('');
    console.log(`   Avg stats size: ${Math.round(verify.avg_stats_size)} bytes`);
    console.log(`   Fetch window: ${verify.first_fetch} → ${verify.last_fetch}`);
    console.log('');

    // Sample team data with recorded_matches (CRITICAL for UI)
    console.log('[6/6] Sample LastX data (first 3 teams, Last 5 window):');
    const sampleResult = await pool.query(`
      SELECT
        team_id,
        name,
        last_x,
        scope,
        CASE
          WHEN scope = 0 THEN 'Overall'
          WHEN scope = 1 THEN 'Home'
          WHEN scope = 2 THEN 'Away'
        END as scope_label,
        stats->'seasonMatchesPlayed_overall' as recorded_matches,
        stats->'seasonPPG_overall' as ppg,
        stats->'seasonBTTSPercentage_overall' as btts_pct,
        stats->'seasonOver25Percentage_overall' as over25_pct,
        stats->'seasonGoals_overall' as goals_scored,
        stats->'seasonConceded_overall' as goals_conceded,
        LEFT(source_hash, 16) || '...' as hash
      FROM fs_team_lastx_stats
      WHERE competition_id = $1
        AND last_x = 5
        AND scope = 0
      ORDER BY team_id
      LIMIT 3
    `, [competitionId]);

    sampleResult.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ${row.name || 'Unknown'} (ID: ${row.team_id}) - ${row.scope_label}`);
      console.log(`   Window: Last ${row.last_x}`);
      console.log(`   🔢 Recorded Matches: ${row.recorded_matches || 'N/A'} (CRITICAL: Shows actual data availability)`);

      if (row.recorded_matches) {
        console.log(`   PPG: ${row.ppg || 'N/A'}`);
        console.log(`   BTTS%: ${row.btts_pct || 'N/A'}%`);
        console.log(`   Over2.5%: ${row.over25_pct || 'N/A'}%`);
        console.log(`   Goals: ${row.goals_scored || 0} scored, ${row.goals_conceded || 0} conceded`);
      } else {
        console.log(`   ⚠️  No stats available (team may have < ${row.last_x} matches)`);
      }

      console.log(`   Hash: ${row.hash}`);
    });

    // Show Last 5/6/10 comparison for first team
    console.log('\n');
    console.log('Last 5 vs Last 6 vs Last 10 comparison (first team):');
    const comparisonResult = await pool.query(`
      SELECT
        name,
        last_x,
        stats->'seasonMatchesPlayed_overall' as matches,
        stats->'seasonPPG_overall' as ppg,
        stats->'seasonOver25Percentage_overall' as over25,
        stats->'seasonBTTSPercentage_overall' as btts
      FROM fs_team_lastx_stats
      WHERE competition_id = $1
        AND scope = 0
        AND team_id = (
          SELECT team_id
          FROM fs_team_lastx_stats
          WHERE competition_id = $1
          ORDER BY team_id
          LIMIT 1
        )
      ORDER BY last_x
    `, [competitionId]);

    if (comparisonResult.rows.length > 0) {
      const teamName = comparisonResult.rows[0].name;
      console.log(`Team: ${teamName}`);

      comparisonResult.rows.forEach(row => {
        console.log(`  Last ${row.last_x}: ${row.matches || 0} matches, PPG ${row.ppg || 'N/A'}, Over2.5% ${row.over25 || 'N/A'}%, BTTS% ${row.btts || 'N/A'}%`);
      });
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));
    console.log('');
    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   1. Always show "recorded_matches" in UI to avoid misleading percentages');
    console.log('   2. 100% BTTS with only 2 matches is different from 100% with 10 matches');
    console.log('   3. TTL cache: 6 hours (prevents redundant API calls)');
    console.log('   4. Re-run test immediately to verify hash guard (expect 0 updates)');
    console.log('');

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
