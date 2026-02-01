import dotenv from 'dotenv';
import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('🔄 FETCH ALL RECENT STANDINGS');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Get recent season updates from /data/update
    console.log('STEP 1: Fetching /data/update...');
    console.log('-'.repeat(80));
    const dataUpdate = await theSportsAPI.get('/data/update', {});

    // Extract all season_ids from keys "3", "4", "5", "6"
    const allSeasonUpdates: any[] = [];
    ['3', '4', '5', '6'].forEach(key => {
      if (dataUpdate.results[key] && Array.isArray(dataUpdate.results[key])) {
        allSeasonUpdates.push(...dataUpdate.results[key]);
      }
    });

    const seasonIds = [...new Set(allSeasonUpdates.map((item: any) => item.season_id))];
    console.log(`✅ Found ${seasonIds.length} updated season_ids in last 120 seconds`);
    console.log('Season IDs:', seasonIds);
    console.log('');

    // Step 2: For each season, get standings
    console.log('STEP 2: Fetching standings for each season...');
    console.log('-'.repeat(80));

    let successCount = 0;
    let failedCount = 0;

    for (const seasonId of seasonIds) {
      try {
        console.log(`Fetching season ${seasonId}...`);

        const standings = await theSportsAPI.get('/season/recent/table/detail', {
          uuid: seasonId
        });

        if (standings.results && standings.results.tables && standings.results.tables.length > 0) {
          const table = standings.results.tables[0];
          const rows = table.rows || [];

          // Get competition name from database
          const seasonInfo = await pool.query(`
            SELECT c.name as comp_name, c.external_id as comp_id
            FROM ts_seasons s
            LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
            WHERE s.external_id = $1
            LIMIT 1;
          `, [seasonId]);

          const compName = seasonInfo.rows.length > 0 ? seasonInfo.rows[0].comp_name : 'Unknown';
          const compId = seasonInfo.rows.length > 0 ? seasonInfo.rows[0].comp_id : 'Unknown';

          console.log(`  ✅ ${compName} (${compId}) - ${rows.length} teams`);

          // Show top 3
          if (rows.length > 0) {
            const teamIds = rows.slice(0, 3).map((r: any) => r.team_id);
            const teams = await pool.query(`
              SELECT external_id, name
              FROM ts_teams
              WHERE external_id = ANY($1::text[])
            `, [teamIds]);

            const teamMap: any = {};
            teams.rows.forEach(t => teamMap[t.external_id] = t.name);

            rows.slice(0, 3).forEach((team: any) => {
              const teamName = teamMap[team.team_id] || 'Unknown';
              console.log(`     ${team.position}. ${teamName} - ${team.points} pts`);
            });
          }

          // Save to database
          await pool.query(`
            INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (season_id)
            DO UPDATE SET
              standings = EXCLUDED.standings,
              raw_response = EXCLUDED.raw_response,
              updated_at = NOW()
          `, [seasonId, JSON.stringify(rows), JSON.stringify(standings)]);

          successCount++;
        } else {
          console.log(`  ❌ No standings data`);
          failedCount++;
        }

        console.log('');

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err: any) {
        console.error(`  ❌ Error: ${err.message}`);
        failedCount++;
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('SUMMARY:');
    console.log(`  Success: ${successCount}/${seasonIds.length}`);
    console.log(`  Failed: ${failedCount}`);
    console.log('='.repeat(80));

    // Step 3: Check if Süper Lig is in the updated seasons
    console.log('');
    console.log('STEP 3: Checking Süper Lig...');
    console.log('-'.repeat(80));

    const superligCheck = await pool.query(`
      SELECT
        s.external_id as season_id,
        c.name as comp_name,
        st.updated_at
      FROM ts_seasons s
      INNER JOIN ts_competitions c ON s.competition_id = c.external_id
      LEFT JOIN ts_standings st ON st.season_id = s.external_id
      WHERE c.external_id = '8y39mp1h6jmojxg'
      ORDER BY s.external_id DESC
      LIMIT 1;
    `);

    if (superligCheck.rows.length > 0) {
      const row = superligCheck.rows[0];
      console.log(`Competition: ${row.comp_name}`);
      console.log(`Season ID: ${row.season_id}`);
      console.log(`Last Updated: ${row.updated_at || 'Never'}`);

      if (seasonIds.includes(row.season_id)) {
        console.log('✅ Süper Lig WAS in recent updates - should be fresh now!');
      } else {
        console.log('⚠️  Süper Lig was NOT in recent updates (no recent matches)');
      }
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
  }

  await pool.end();
  process.exit(0);
}

main();
