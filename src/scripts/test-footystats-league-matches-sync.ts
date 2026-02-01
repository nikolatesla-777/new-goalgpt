// src/scripts/test-footystats-league-matches-sync.ts
import dotenv from 'dotenv';
import { runFootyStatsLeagueMatchesSeasonSync } from '../jobs/footyStatsLeagueMatchesSeasonSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('='.repeat(80));
  console.log('FootyStats League Matches Season Sync - Test Script');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test connection
    console.log('[1/5] Testing database connection...');
    const connTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connTest.rows[0].now);
    console.log('');

    // Run sync for fs_season_id = 14972
    console.log('[2/5] Fetching FootyStats matches for fs_season_id=14972...');
    const result = await runFootyStatsLeagueMatchesSeasonSync(14972);
    console.log('✅ Sync completed:', result);
    console.log('');

    // Verify matches
    console.log('[3/5] Verifying matches in fs_matches...');
    const matchesCount = await pool.query(`
      SELECT
        COUNT(*) as total_matches,
        COUNT(DISTINCT status) as unique_statuses,
        COUNT(CASE WHEN status = 'complete' THEN 1 END) as completed_matches
      FROM fs_matches
      WHERE fs_season_id = 14972
    `);
    const matchStats = matchesCount.rows[0];
    console.log(`✅ Matches for fs_season_id=14972:`);
    console.log(`   Total: ${matchStats.total_matches}`);
    console.log(`   Unique statuses: ${matchStats.unique_statuses}`);
    console.log(`   Completed: ${matchStats.completed_matches}`);
    console.log('');

    // Verify match stats
    console.log('[4/5] Verifying match stats...');
    const statsCount = await pool.query(`
      SELECT
        COUNT(*) as total_stats,
        COUNT(btts) as btts_count,
        COUNT(over25) as over25_count,
        COUNT(corners_total) as corners_count,
        COUNT(cards_total) as cards_count,
        AVG(LENGTH(raw_jsonb::text)) as avg_raw_size
      FROM fs_match_stats ms
      JOIN fs_matches m ON ms.fs_match_id = m.fs_match_id
      WHERE m.fs_season_id = 14972
    `);
    const statsData = statsCount.rows[0];
    console.log(`✅ Match stats for fs_season_id=14972:`);
    console.log(`   Total stats: ${statsData.total_stats}`);
    console.log(`   BTTS count: ${statsData.btts_count}`);
    console.log(`   Over2.5 count: ${statsData.over25_count}`);
    console.log(`   Corners count: ${statsData.corners_count}`);
    console.log(`   Cards count: ${statsData.cards_count}`);
    console.log(`   Avg raw JSONB size: ${Math.round(statsData.avg_raw_size)} bytes`);
    console.log('');

    // Sample completed matches
    console.log('[5/5] Sample completed matches (first 3):');
    const sampleMatches = await pool.query(`
      SELECT
        m.fs_match_id,
        m.status,
        m.game_week,
        m.home_team_fs_id,
        m.away_team_fs_id,
        ms.home_goal_count,
        ms.away_goal_count,
        ms.total_goal_count,
        ms.btts,
        ms.over25,
        ms.corners_total,
        ms.cards_total,
        LEFT(ms.source_hash, 16) || '...' as hash_preview
      FROM fs_matches m
      JOIN fs_match_stats ms ON m.fs_match_id = ms.fs_match_id
      WHERE m.fs_season_id = 14972
        AND m.status = 'complete'
      ORDER BY m.game_week DESC, m.fs_match_id DESC
      LIMIT 3
    `);

    sampleMatches.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. Match ${row.fs_match_id} (GW ${row.game_week}):`);
      console.log(`   Status: ${row.status}`);
      console.log(`   Score: ${row.home_goal_count}-${row.away_goal_count} (Total: ${row.total_goal_count})`);
      console.log(`   BTTS: ${row.btts}, Over2.5: ${row.over25}`);
      console.log(`   Corners: ${row.corners_total}, Cards: ${row.cards_total}`);
      console.log(`   Hash: ${row.hash_preview}`);
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
