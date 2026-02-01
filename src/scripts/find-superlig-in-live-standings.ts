import dotenv from 'dotenv';
import { pool } from '../database/connection';
import { theSportsAPI } from '../core/TheSportsAPIManager';

dotenv.config();

async function main() {
  console.log('🔍 FIND SÜPER LİG IN LIVE STANDINGS');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Fetch all live standings
    console.log('📡 Fetching /table/live...');
    const response = await theSportsAPI.get<{ code: number; results: any[] }>('/table/live', {});

    if (!response.results || response.results.length === 0) {
      console.log('❌ No standings returned');
      process.exit(1);
    }

    console.log(`✅ Received ${response.results.length} season standings`);
    console.log('');

    // 2. Get season IDs from response
    const seasonIds = response.results.map((r: any) => r.season_id);

    // 3. Query database to find which competitions these seasons belong to
    const seasonsInfo = await pool.query(`
      SELECT s.external_id as season_id, c.external_id as comp_id, c.name as comp_name
      FROM ts_seasons s
      LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
      WHERE s.external_id = ANY($1::text[])
      ORDER BY c.name;
    `, [seasonIds]);

    console.log('📋 COMPETITIONS IN LIVE STANDINGS:');
    console.log('='.repeat(80));

    seasonsInfo.rows.forEach((row: any, idx: number) => {
      const isSuperLig = row.comp_name?.toLowerCase().includes('super') && row.comp_name?.toLowerCase().includes('turk');
      const prefix = isSuperLig ? '👉' : '  ';

      console.log(`${prefix} ${idx + 1}. ${row.comp_name || 'Unknown'}`);
      console.log(`     Season ID: ${row.season_id}`);
      console.log(`     Comp ID: ${row.comp_id || 'N/A'}`);
    });

    console.log('');
    console.log('='.repeat(80));

    // 4. Find Süper Lig specifically
    const superLigSeason = seasonsInfo.rows.find((row: any) =>
      row.comp_name?.toLowerCase().includes('super') && row.comp_name?.toLowerCase().includes('turk')
    );

    if (superLigSeason) {
      console.log('✅ FOUND SÜPER LİG IN LIVE STANDINGS!');
      console.log(`   Season ID: ${superLigSeason.season_id}`);
      console.log(`   Comp ID: ${superLigSeason.comp_id}`);
      console.log('');

      // Get the standings for this season
      const seasonData = response.results.find((r: any) => r.season_id === superLigSeason.season_id);

      if (seasonData && seasonData.tables && seasonData.tables.length > 0) {
        const table = seasonData.tables[0];
        const rows = table.rows || [];

        console.log('🇹🇷 SÜPER LİG STANDINGS:');
        console.log('='.repeat(80));

        // Get team names
        const teamIds = rows.map((r: any) => r.team_id);
        const teams = await pool.query(`
          SELECT external_id, name
          FROM ts_teams
          WHERE external_id = ANY($1::text[])
        `, [teamIds]);

        const teamMap: any = {};
        teams.rows.forEach(t => teamMap[t.external_id] = t.name);

        // Display standings
        rows.forEach((team: any) => {
          const teamName = teamMap[team.team_id] || 'Unknown';
          const isTrabzon = teamName.toLowerCase().includes('trabzon');
          const prefix = isTrabzon ? '👉' : '  ';

          console.log(`${prefix} ${team.position}. ${teamName} - ${team.points} pts (MP:${team.total} W:${team.won} D:${team.draw} L:${team.loss} GD:${team.goal_diff})`);

          // Verify Trabzonspor
          if (isTrabzon) {
            if (team.points === 42) {
              console.log('     ✅ VERIFIED: Trabzonspor points = 42');
            } else {
              console.log(`     ⚠️ WARNING: Expected 42 points, got ${team.points}`);
            }
          }
        });

        console.log('');
        console.log('='.repeat(80));
      }
    } else {
      console.log('❌ Süper Lig not found in live standings');
    }

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

main();
