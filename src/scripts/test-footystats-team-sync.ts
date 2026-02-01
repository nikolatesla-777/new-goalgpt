// src/scripts/test-footystats-team-sync.ts
import dotenv from 'dotenv';
import { runFootyStatsTeamSync } from '../jobs/footyStatsTeamSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('='.repeat(80));
  console.log('FootyStats Individual Team Sync - Test Script');
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

    // Get the actual season from synced data (after first run)
    const seasonResult = await pool.query(`
      SELECT DISTINCT season
      FROM fs_team_snapshots
      WHERE competition_id = $1
      ORDER BY season DESC
      LIMIT 1
    `, [competitionId]);

    const season = seasonResult.rows.length > 0
      ? seasonResult.rows[0].season
      : '2025/2026'; // Fallback to current season

    console.log(`✅ Using competition_id=${competitionId}, season=${season}`);
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
    console.log('[4/6] Running FootyStats team sync...');
    const result = await runFootyStatsTeamSync(competitionId, season, 5);
    console.log('✅ Sync completed:', result);
    console.log('');

    // Verify results
    console.log('[5/6] Verifying synced data...');
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total_snapshots,
        COUNT(DISTINCT team_id) as unique_teams,
        COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as with_name,
        COUNT(CASE WHEN stadium_name IS NOT NULL THEN 1 END) as with_stadium,
        AVG(LENGTH(raw::text)) as avg_raw_size
      FROM fs_team_snapshots
      WHERE competition_id = $1 AND season = $2
    `, [competitionId, season]);

    const statsVerifyResult = await pool.query(`
      SELECT
        COUNT(*) as total_stats,
        COUNT(CASE WHEN matches_played_overall IS NOT NULL THEN 1 END) as with_matches,
        COUNT(CASE WHEN ppg_overall IS NOT NULL THEN 1 END) as with_ppg,
        COUNT(CASE WHEN btts_pct_overall IS NOT NULL THEN 1 END) as with_btts,
        COUNT(CASE WHEN over25_pct_overall IS NOT NULL THEN 1 END) as with_over25,
        AVG(LENGTH(stats_raw::text)) as avg_stats_size
      FROM fs_team_snapshot_stats
      WHERE competition_id = $1 AND season = $2
    `, [competitionId, season]);

    const snapshots = verifyResult.rows[0];
    const stats = statsVerifyResult.rows[0];

    console.log(`✅ Team Snapshots (competition_id=${competitionId}, season=${season}):`);
    console.log(`   Total: ${snapshots.total_snapshots}`);
    console.log(`   Unique teams: ${snapshots.unique_teams}`);
    console.log(`   With name: ${snapshots.with_name}`);
    console.log(`   With stadium: ${snapshots.with_stadium}`);
    console.log(`   Avg raw size: ${Math.round(snapshots.avg_raw_size)} bytes`);
    console.log('');

    console.log(`✅ Team Stats (competition_id=${competitionId}, season=${season}):`);
    console.log(`   Total: ${stats.total_stats}`);
    console.log(`   With matches_played: ${stats.with_matches}`);
    console.log(`   With PPG: ${stats.with_ppg}`);
    console.log(`   With BTTS%: ${stats.with_btts}`);
    console.log(`   With Over2.5%: ${stats.with_over25}`);
    console.log(`   Avg stats size: ${Math.round(stats.avg_stats_size)} bytes`);
    console.log('');

    // Sample team data
    console.log('[6/6] Sample team data (first 3):');
    const sampleResult = await pool.query(`
      SELECT
        s.team_id,
        s.name,
        s.country,
        s.stadium_name,
        st.matches_played_overall,
        st.goals_scored_overall,
        st.goals_conceded_overall,
        st.ppg_overall,
        st.btts_pct_overall,
        st.over25_pct_overall,
        LEFT(s.source_hash, 16) || '...' as meta_hash,
        LEFT(st.source_hash, 16) || '...' as stats_hash
      FROM fs_team_snapshots s
      JOIN fs_team_snapshot_stats st ON s.team_id = st.team_id
        AND s.competition_id = st.competition_id
        AND s.season = st.season
      WHERE s.competition_id = $1 AND s.season = $2
      ORDER BY s.team_id
      LIMIT 3
    `, [competitionId, season]);

    sampleResult.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ${row.name || 'Unknown'} (ID: ${row.team_id})`);
      console.log(`   Country: ${row.country || 'N/A'}`);
      console.log(`   Stadium: ${row.stadium_name || 'N/A'}`);
      console.log(`   Matches: ${row.matches_played_overall || 0}`);
      console.log(`   Goals: ${row.goals_scored_overall || 0} scored, ${row.goals_conceded_overall || 0} conceded`);
      console.log(`   PPG: ${row.ppg_overall || 'N/A'}`);
      console.log(`   BTTS%: ${row.btts_pct_overall || 'N/A'}, Over2.5%: ${row.over25_pct_overall || 'N/A'}`);
      console.log(`   Meta Hash: ${row.meta_hash}`);
      console.log(`   Stats Hash: ${row.stats_hash}`);
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
