import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';

async function main() {
  console.log('🔄 FETCH STANDINGS FOR ALL ALLOWLIST LEAGUES (2025-2026)\n');
  console.log('='.repeat(80));

  // Step 1: Get all enabled competitions from FootyStats allowlist
  console.log('\nSTEP 1: Getting enabled competitions from FootyStats allowlist...');
  const allowlist = await pool.query(`
    SELECT
      competition_id,
      name,
      country
    FROM fs_competitions_allowlist
    WHERE is_enabled = true
    ORDER BY name
  `);

  console.log(`Found ${allowlist.rows.length} enabled competitions\n`);

  // Step 2: Match with ts_competitions and get 2025-2026 seasons
  console.log('STEP 2: Finding 2025-2026 seasons...');
  const seasonIds: any[] = [];

  for (const comp of allowlist.rows) {
    // Match by name
    const tsComp = await pool.query(`
      SELECT external_id, name
      FROM ts_competitions
      WHERE name ILIKE $1
      LIMIT 1
    `, [comp.name]);

    if (tsComp.rows.length === 0) {
      console.log(`⚠️  No TheSports match for: ${comp.name}`);
      continue;
    }

    const tsCompId = tsComp.rows[0].external_id;

    // Get 2025-2026 season
    const seasons = await pool.query(`
      SELECT external_id, year
      FROM ts_seasons
      WHERE competition_id = $1
        AND (year IN ('2025', '2026', '2025-2026') OR year LIKE '%2025%' OR year LIKE '%2026%')
      ORDER BY year DESC
      LIMIT 1
    `, [tsCompId]);

    if (seasons.rows.length > 0) {
      seasonIds.push({
        season_id: seasons.rows[0].external_id,
        comp_name: comp.name,
        comp_id: tsCompId,
        year: seasons.rows[0].year
      });
    } else {
      console.log(`⚠️  No 2025-2026 season for: ${comp.name}`);
    }
  }

  console.log(`Found ${seasonIds.length} seasons for 2025-2026\n`);

  // Step 3: Fetch standings for each season
  console.log('STEP 3: Fetching standings...\n');
  console.log('-'.repeat(80));

  let successCount = 0;
  let failedCount = 0;
  const failedLeagues: string[] = [];

  for (const item of seasonIds) {
    try {
      console.log(`Fetching: ${item.comp_name} (${item.year})...`);

      const standings = await theSportsAPI.get('/season/recent/table/detail', {
        uuid: item.season_id
      });

      if (standings.results && standings.results.tables && standings.results.tables.length > 0) {
        const table = standings.results.tables[0];
        const rows = table.rows || [];

        if (rows.length > 0) {
          // Save to database
          await pool.query(`
            INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (season_id)
            DO UPDATE SET
              standings = EXCLUDED.standings,
              raw_response = EXCLUDED.raw_response,
              updated_at = NOW()
          `, [item.season_id, JSON.stringify(rows), JSON.stringify(standings)]);

          console.log(`  ✅ ${rows.length} teams - SAVED`);
          successCount++;
        } else {
          console.log(`  ⚠️  Empty standings`);
          failedCount++;
          failedLeagues.push(item.comp_name);
        }
      } else {
        console.log(`  ❌ No tables in response`);
        failedCount++;
        failedLeagues.push(item.comp_name);
      }

      // Rate limit (120 requests/min = 1 every 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      failedCount++;
      failedLeagues.push(item.comp_name);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log(`  Total: ${seasonIds.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed: ${failedCount}`);

  if (failedLeagues.length > 0) {
    console.log(`\nFailed leagues:`);
    failedLeagues.forEach(league => console.log(`  - ${league}`));
  }

  // Verify Süper Lig
  console.log('\n' + '='.repeat(80));
  console.log('SÜPER LIG VERIFICATION:');
  const superlig = await pool.query(`
    SELECT st.standings, st.updated_at
    FROM ts_standings st
    INNER JOIN ts_seasons s ON st.season_id = s.external_id
    WHERE s.competition_id = '8y39mp1h6jmojxg'
      AND s.year LIKE '%2025%'
    LIMIT 1
  `);

  if (superlig.rows.length > 0) {
    const standings = superlig.rows[0].standings;
    const trabzonspor = standings.find((team: any) => team.team_id === 'kn54qllhy0dqvy9');

    console.log(`Last Updated: ${superlig.rows[0].updated_at}`);
    if (trabzonspor) {
      console.log(`Trabzonspor: Position ${trabzonspor.position}, ${trabzonspor.points} points`);
    }
  } else {
    console.log('❌ Süper Lig not found');
  }

  console.log('='.repeat(80));

  await pool.end();
  process.exit(0);
}

main();
