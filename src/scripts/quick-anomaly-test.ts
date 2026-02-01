import dotenv from 'dotenv';
import { runFootyStatsTeamsCatalogSync } from '../jobs/footyStatsTeamsCatalogSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('Quick Anomaly Detection Test');
  console.log('='.repeat(60));

  // Enable only 5 test competitions (ones we know have issues)
  await pool.query(`
    UPDATE fs_competitions_allowlist
    SET is_enabled = FALSE;

    UPDATE fs_competitions_allowlist
    SET is_enabled = TRUE
    WHERE competition_id IN (22, 25, 26, 27, 14972);
  `);

  console.log('Enabled 5 test competitions (22, 25, 26, 27, 14972)');
  console.log('');

  // Run sync
  console.log('Running sync...');
  const result = await runFootyStatsTeamsCatalogSync(true, 5);
  console.log('Sync result:', result);
  console.log('');

  // Check duplicates
  console.log('Checking for duplicates...');
  const dupResult = await pool.query(`
    SELECT
      team_id,
      team_name,
      COUNT(DISTINCT competition_id) as competition_count,
      array_agg(DISTINCT competition_id ORDER BY competition_id) as competitions
    FROM fs_teams_catalog
    WHERE season = '2025/2026'
    GROUP BY team_id, team_name
    HAVING COUNT(DISTINCT competition_id) > 1
    ORDER BY competition_count DESC
    LIMIT 10;
  `);

  if (dupResult.rows.length === 0) {
    console.log('✅ NO DUPLICATES FOUND!');
  } else {
    console.log(`❌ Found ${dupResult.rows.length} duplicates:`);
    dupResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. [${row.team_id}] ${row.team_name}: ${row.competition_count} competitions ${JSON.stringify(row.competitions)}`);
    });
  }

  // Re-enable all
  await pool.query(`UPDATE fs_competitions_allowlist SET is_enabled = TRUE;`);
  console.log('');
  console.log('All competitions re-enabled');

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
