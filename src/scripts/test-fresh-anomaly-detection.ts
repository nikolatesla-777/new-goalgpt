import dotenv from 'dotenv';
import { runFootyStatsTeamsCatalogSync } from '../jobs/footyStatsTeamsCatalogSync.job';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('Fresh Anomaly Detection Test');
  console.log('='.repeat(60));

  // Step 1: Clear test data
  console.log('Step 1: Clearing test data...');
  await pool.query(`
    DELETE FROM fs_teams_catalog WHERE competition_id IN (22, 25, 26, 27, 14972);
  `);

  await pool.query(`
    DELETE FROM fs_job_hashes
    WHERE job_name = 'teams_catalog_sync'
    AND entity_key IN (
      '22:2025/2026',
      '25:2025/2026',
      '26:2025/2026',
      '27:2025/2026',
      '14972:2025/2026'
    );
  `);

  // Clear old anomalies
  const beforeAnomalies = await pool.query(
    `SELECT COUNT(*) as count FROM fs_sync_anomalies WHERE detected_at > NOW() - INTERVAL '1 hour'`
  );
  console.log(`Anomalies in last hour (before): ${beforeAnomalies.rows[0].count}`);
  console.log('');

  // Step 2: Enable only test competitions
  await pool.query(`
    UPDATE fs_competitions_allowlist
    SET is_enabled = FALSE;

    UPDATE fs_competitions_allowlist
    SET is_enabled = TRUE
    WHERE competition_id IN (22, 25, 26, 27, 14972);
  `);

  console.log('Enabled 5 test competitions (22, 25, 26, 27, 14972)');
  console.log('');

  // Step 3: Run sync with force fetch
  console.log('Step 2: Running sync (force fetch)...');
  const result = await runFootyStatsTeamsCatalogSync(true, 5);
  console.log('Sync result:', result);
  console.log('');

  // Step 4: Check for duplicates
  console.log('Step 3: Checking for duplicates...');
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
  console.log('');

  // Step 5: Check anomalies
  console.log('Step 4: Checking anomalies...');
  const afterAnomalies = await pool.query(`
    SELECT
      anomaly_type,
      severity,
      COUNT(*) as count
    FROM fs_sync_anomalies
    WHERE detected_at > NOW() - INTERVAL '1 hour'
    GROUP BY anomaly_type, severity
    ORDER BY count DESC;
  `);

  if (afterAnomalies.rows.length === 0) {
    console.log('No anomalies detected');
  } else {
    console.log('Anomalies detected:');
    afterAnomalies.rows.forEach((row) => {
      console.log(`  ${row.anomaly_type} (${row.severity}): ${row.count}`);
    });
  }
  console.log('');

  // Step 6: Show sample rejected teams
  console.log('Step 5: Sample rejected teams...');
  const sampleAnomalies = await pool.query(`
    SELECT
      entity_id,
      expected_value,
      actual_value,
      details->>'team_name' as team_name,
      details->>'current_competition' as current_competition
    FROM fs_sync_anomalies
    WHERE detected_at > NOW() - INTERVAL '1 hour'
    AND anomaly_type = 'duplicate_team'
    ORDER BY detected_at DESC
    LIMIT 5;
  `);

  sampleAnomalies.rows.forEach((row, idx) => {
    console.log(`  ${idx + 1}. ${row.team_name} (${row.entity_id})`);
    console.log(`     Competition: ${row.current_competition}`);
  });

  // Re-enable all competitions
  await pool.query(`UPDATE fs_competitions_allowlist SET is_enabled = TRUE;`);
  console.log('');
  console.log('All competitions re-enabled');

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
