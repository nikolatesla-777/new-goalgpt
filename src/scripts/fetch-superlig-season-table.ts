import dotenv from 'dotenv';
import { pool } from '../database/connection';
import { theSportsAPI } from '../core/TheSportsAPIManager';

dotenv.config();

async function main() {
  console.log('🔄 FETCH SÜPER LİG STANDINGS VIA /season/table');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Get Süper Lig season
    const seasonResult = await pool.query(`
      SELECT s.external_id as season_id, c.name as comp_name
      FROM ts_seasons s
      LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
      WHERE c.external_id = '8y39mp1h6jmojxg'
      ORDER BY s.external_id DESC
      LIMIT 1;
    `);

    if (seasonResult.rows.length === 0) {
      console.log('❌ Süper Lig season not found');
      process.exit(1);
    }

    const { season_id, comp_name } = seasonResult.rows[0];

    console.log('Competition:', comp_name);
    console.log('Season ID:', season_id);
    console.log('');

    // 2. Fetch standings using /season/table endpoint
    console.log('📡 Fetching from /season/table...');
    const response = await theSportsAPI.get<{ code: number; results: any }>('/season/table', {
      uuid: season_id
    });

    console.log('');
    console.log('DEBUG - Response Structure:');
    console.log(JSON.stringify(response, null, 2).slice(0, 2000));
    console.log('');

    if (!response.results) {
      console.log('❌ No results in response');
      process.exit(1);
    }

    // Results might be { overall: [...], home: [...], away: [...] } or direct array
    let standingsArray: any[] = [];

    if (Array.isArray(response.results)) {
      standingsArray = response.results;
    } else if (response.results.overall) {
      standingsArray = response.results.overall;
    } else if (response.results.total) {
      standingsArray = response.results.total;
    } else {
      // Try to extract first array from object
      const values = Object.values(response.results);
      standingsArray = values.find((v: any) => Array.isArray(v)) || [];
    }

    if (standingsArray.length === 0) {
      console.log('❌ No teams in standings');
      process.exit(1);
    }

    console.log(`✅ Found ${standingsArray.length} teams`);
    console.log('');

    // 3. Get team names
    const teamIds = standingsArray.map((t: any) => t.team_id);
    const teams = await pool.query(`
      SELECT external_id, name
      FROM ts_teams
      WHERE external_id = ANY($1::text[])
    `, [teamIds]);

    const teamMap: any = {};
    teams.rows.forEach(t => teamMap[t.external_id] = t.name);

    // 4. Display standings
    console.log('🇹🇷 SÜPER LİG PUAN DURUMU:');
    console.log('='.repeat(80));

    standingsArray.forEach((team: any) => {
      const teamName = teamMap[team.team_id] || 'Unknown';
      const isTrabzon = teamName.toLowerCase().includes('trabzon');
      const prefix = isTrabzon ? '👉' : '  ';

      console.log(`${prefix} ${team.position}. ${teamName} - ${team.points} pts (MP:${team.total || team.played} W:${team.won} D:${team.draw || team.drawn} L:${team.loss || team.lost} GD:${team.goal_diff})`);

      // Verify Trabzonspor
      if (isTrabzon) {
        if (team.points === 42) {
          console.log('     ✅ VERIFIED: Trabzonspor points = 42');
        } else {
          console.log(`     ⚠️ Current points: ${team.points} (Expected: 42)`);
        }
      }
    });

    console.log('');
    console.log('='.repeat(80));

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
