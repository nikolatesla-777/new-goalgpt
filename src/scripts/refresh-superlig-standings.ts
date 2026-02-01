import dotenv from 'dotenv';
import { pool } from '../database/connection';
import { SeasonStandingsService } from '../services/thesports/season/standings.service';

dotenv.config();

const standingsService = new SeasonStandingsService();

async function main() {
  console.log('🔄 REFRESH SÜPER LİG STANDINGS');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Get Süper Lig competition and current season
    const compResult = await pool.query(`
      SELECT c.external_id as comp_id, c.name as comp_name, s.external_id as season_id
      FROM ts_competitions c
      LEFT JOIN ts_seasons s ON s.competition_id = c.external_id
      WHERE c.external_id = '8y39mp1h6jmojxg'
      ORDER BY s.external_id DESC
      LIMIT 1;
    `);

    if (compResult.rows.length === 0) {
      console.log('❌ Süper Lig competition or season not found');
      process.exit(1);
    }

    const { comp_id, comp_name, season_id } = compResult.rows[0];

    console.log('Competition:', comp_name);
    console.log('Competition ID:', comp_id);
    console.log('Season ID:', season_id);
    console.log('');

    // 2. Fetch fresh standings using the existing service
    console.log('📡 Fetching fresh standings from TheSports API...');
    const response = await standingsService.getSeasonStandings({ season_id });

    if (!response.results || response.results.length === 0) {
      console.log('❌ No standings returned');
      process.exit(1);
    }

    console.log(`✅ Received ${response.results.length} teams`);
    console.log('');

    // 3. Display standings
    console.log('🇹🇷 SÜPER LİG PUAN DURUMU:');
    console.log('='.repeat(80));

    response.results.forEach((team: any) => {
      const isTrabzon = team.team_name?.toLowerCase().includes('trabzon');
      const prefix = isTrabzon ? '👉' : '  ';

      console.log(`${prefix} ${team.position}. ${team.team_name || 'Unknown'} - ${team.points} pts (MP:${team.played} W:${team.won} D:${team.drawn} L:${team.lost} GD:${team.goal_diff})`);

      // Verify Trabzonspor points
      if (isTrabzon) {
        if (team.points === 42) {
          console.log('   ✅ VERIFIED: Trabzonspor points = 42');
        } else {
          console.log(`   ⚠️ WARNING: Expected 42 points, got ${team.points}`);
        }
      }
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ Süper Lig standings refreshed successfully!');

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
