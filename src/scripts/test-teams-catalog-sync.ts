// src/scripts/test-teams-catalog-sync.ts
import dotenv from 'dotenv';
import { runFootyStatsTeamsCatalogSync } from '../jobs/footyStatsTeamsCatalogSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('='.repeat(80));
  console.log('FootyStats Teams Catalog Sync - Test Script');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test connection
    console.log('[1/6] Testing database connection...');
    const connTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connTest.rows[0].now);
    console.log('');

    // Check allowlist
    console.log('[2/6] Checking competitions allowlist...');
    const allowlistResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_enabled = true THEN 1 END) as enabled,
        COUNT(CASE WHEN is_enabled = false THEN 1 END) as disabled
      FROM fs_competitions_allowlist
    `);

    const allowlist = allowlistResult.rows[0];
    console.log(`✅ Allowlist status:`);
    console.log(`   Total: ${allowlist.total}`);
    console.log(`   Enabled: ${allowlist.enabled}`);
    console.log(`   Disabled: ${allowlist.disabled}`);

    if (allowlist.enabled === '0') {
      console.log('');
      console.log('⚠️  WARNING: No enabled competitions found!');
      console.log('   Run seed script first: npm run seed:allowlist');
      console.log('');
      process.exit(1);
    }
    console.log('');

    // Count teams before sync
    console.log('[3/6] Counting teams in catalog (before sync)...');
    const beforeResult = await pool.query(`
      SELECT
        COUNT(*) as total_teams,
        COUNT(DISTINCT competition_id) as unique_competitions,
        COUNT(DISTINCT season) as unique_seasons
      FROM fs_teams_catalog
    `);

    const before = beforeResult.rows[0];
    console.log(`✅ Current catalog:`);
    console.log(`   Teams: ${before.total_teams}`);
    console.log(`   Competitions: ${before.unique_competitions}`);
    console.log(`   Seasons: ${before.unique_seasons}`);
    console.log('');

    // Run sync
    console.log('[4/6] Running Teams Catalog Sync...');
    console.log('⏳ This may take a while (TTL cache enabled: 12 hours)...');
    const result = await runFootyStatsTeamsCatalogSync(false, 5);
    console.log('✅ Sync completed:', result);
    console.log('');

    // Verify results
    console.log('[5/6] Verifying synced catalog...');
    const verifyResult = await pool.query(`
      SELECT
        COUNT(*) as total_teams,
        COUNT(DISTINCT team_id) as unique_teams,
        COUNT(DISTINCT competition_id) as unique_competitions,
        COUNT(DISTINCT season) as unique_seasons,
        AVG(LENGTH(meta::text)) as avg_meta_size
      FROM fs_teams_catalog
    `);

    const verify = verifyResult.rows[0];
    console.log(`✅ Catalog Statistics:`);
    console.log(`   Total teams: ${verify.total_teams}`);
    console.log(`   Unique team_ids: ${verify.unique_teams}`);
    console.log(`   Unique competitions: ${verify.unique_competitions}`);
    console.log(`   Unique seasons: ${verify.unique_seasons}`);
    console.log(`   Avg meta size: ${Math.round(verify.avg_meta_size)} bytes`);
    console.log('');

    // Season validation
    const seasonCheck = await pool.query(`
      SELECT DISTINCT season
      FROM fs_teams_catalog
      ORDER BY season
    `);

    console.log(`   Seasons in catalog:`);
    seasonCheck.rows.forEach((row, idx) => {
      const isTarget = row.season === '2025/2026' ? '✅' : '⚠️';
      console.log(`     ${idx + 1}. ${isTarget} ${row.season}`);
    });
    console.log('');

    // Sample competitions
    console.log('[6/6] Sample catalog data (first 5 competitions):');
    const sampleResult = await pool.query(`
      SELECT
        c.competition_id,
        c.name as competition_name,
        c.country,
        COUNT(t.team_id) as teams_count,
        (
          SELECT string_agg(team_name, ', ')
          FROM (
            SELECT team_name
            FROM fs_teams_catalog
            WHERE competition_id = c.competition_id AND season = '2025/2026'
            ORDER BY team_name
            LIMIT 3
          ) sub
        ) as sample_teams
      FROM fs_competitions_allowlist c
      LEFT JOIN fs_teams_catalog t ON c.competition_id = t.competition_id
        AND t.season = '2025/2026'
      WHERE c.is_enabled = true
      GROUP BY c.competition_id, c.name, c.country
      ORDER BY teams_count DESC
      LIMIT 5
    `);

    sampleResult.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. [${row.competition_id}] ${row.competition_name} (${row.country})`);
      console.log(`   Teams: ${row.teams_count}`);
      if (row.sample_teams) {
        const teams = row.sample_teams.split(', ').slice(0, 3);
        console.log(`   Sample: ${teams.join(', ')}${row.teams_count > 3 ? ', ...' : ''}`);
      }
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(80));
    console.log('');
    console.log('⚠️  IMPORTANT NOTES:');
    console.log('   1. TTL Cache: 12 hours (prevents redundant API calls)');
    console.log('   2. Season: Only "2025/2026" allowed (hard constraint)');
    console.log('   3. Hash Guard: 0 updates on second run if data unchanged');
    console.log('   4. Re-run immediately to verify TTL cache (expect 0 API calls)');
    console.log('');

    // Hash guard summary
    const hashResult = await pool.query(`
      SELECT
        COUNT(*) as total_hashes,
        MIN(updated_at) as oldest_hash,
        MAX(updated_at) as newest_hash
      FROM fs_job_hashes
      WHERE job_name = 'teams_catalog_sync'
    `);

    if (hashResult.rows[0].total_hashes > 0) {
      const hash = hashResult.rows[0];
      console.log('📊 Hash Guard Status:');
      console.log(`   Total hashes: ${hash.total_hashes}`);
      console.log(`   Oldest: ${hash.oldest_hash}`);
      console.log(`   Newest: ${hash.newest_hash}`);
      console.log('');
    }

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
