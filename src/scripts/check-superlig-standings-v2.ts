import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  try {
    // Find Süper Lig competition (TheSports external_id)
    const comp = await pool.query(`
      SELECT id, external_id, name
      FROM ts_competitions
      WHERE external_id = '8y39mp1h6jmojxg'  -- TheSports Süper Lig ID
      LIMIT 1;
    `);

    if (comp.rows.length === 0) {
      console.log('Süper Lig not found!');
      process.exit(1);
    }

    console.log('Competition:', comp.rows[0].name);
    console.log('External ID:', comp.rows[0].external_id);
    console.log('');

    // Get current season
    const seasonResult = await pool.query(`
      SELECT external_id
      FROM ts_seasons
      WHERE competition_id = $1
      ORDER BY external_id DESC
      LIMIT 1
    `, [comp.rows[0].external_id]);

    if (seasonResult.rows.length === 0) {
      console.log('No season found');
      process.exit(1);
    }

    const seasonId = seasonResult.rows[0].external_id;
    console.log('Season ID:', seasonId);
    console.log('');

    // Get standings
    const standingsResult = await pool.query(`
      SELECT
        s.position,
        s.team_id,
        t.name as team_name,
        s.played,
        s.won,
        s.drawn,
        s.lost,
        s.goals_for,
        s.goals_against,
        s.goal_diff,
        s.points
      FROM ts_standings s
      LEFT JOIN ts_teams t ON s.team_id = t.external_id
      WHERE s.season_id = $1
      ORDER BY s.position ASC
    `, [seasonId]);

    console.log('Süper Lig Puan Durumu (' + standingsResult.rows.length + ' takım):');
    console.log('='.repeat(80));

    standingsResult.rows.forEach((row: any, idx: number) => {
      console.log(`${row.position}. ${row.team_name || 'Unknown'} - ${row.points} pts (MP:${row.played} W:${row.won} D:${row.drawn} L:${row.lost} GD:${row.goal_diff})`);
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('Comparing with FootyStats screenshot:');
    console.log('='.repeat(80));

    const expectedStandings = [
      { position: 1, name: 'Galatasaray', points: 46, played: 19 },
      { position: 2, name: 'Fenerbahçe', points: 43, played: 19 },
      { position: 3, name: 'Trabzonspor', points: 42, played: 20 },
      { position: 4, name: 'Göztepe', points: 36, played: 19 },
      { position: 5, name: 'Beşiktaş', points: 33, played: 19 },
    ];

    console.log('');
    console.log('Expected top 5 (from FootyStats screenshot):');
    expectedStandings.forEach(team => {
      console.log(`  ${team.position}. ${team.name} - ${team.points} pts (MP:${team.played})`);
    });

    console.log('');
    console.log('Actual top 5 (from database):');
    standingsResult.rows.slice(0, 5).forEach((row: any) => {
      console.log(`  ${row.position}. ${row.team_name || 'Unknown'} - ${row.points} pts (MP:${row.played})`);
    });

    // Check if match
    console.log('');
    const matches = expectedStandings.every((expected, idx) => {
      const actual = standingsResult.rows[idx];
      return actual &&
             actual.position === expected.position &&
             actual.points === expected.points &&
             actual.played === expected.played;
    });

    if (matches) {
      console.log('✅ STANDINGS MATCH! Database is up to date with FootyStats.');
    } else {
      console.log('⚠️  STANDINGS DO NOT MATCH! Database may be outdated.');
    }

    // Now check FootyStats catalog
    console.log('');
    console.log('='.repeat(80));
    console.log('FootyStats Teams Catalog (fs_teams_catalog):');
    console.log('='.repeat(80));

    const fsTeams = await pool.query(`
      SELECT
        team_id,
        team_name,
        competition_id
      FROM fs_teams_catalog
      WHERE competition_id = 14972  -- FootyStats Süper Lig ID
        AND season = '2025/2026'
      ORDER BY team_name;
    `);

    console.log('');
    console.log('FootyStats Süper Lig teams (' + fsTeams.rows.length + ' teams):');
    fsTeams.rows.forEach((team: any, idx: number) => {
      console.log(`  ${idx + 1}. [FS ID: ${team.team_id}] ${team.team_name}`);
    });

    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
