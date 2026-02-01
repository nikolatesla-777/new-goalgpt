import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  try {
    // Find Turkish competitions
    const comp = await pool.query(`
      SELECT id, name
      FROM ts_competitions
      WHERE name ILIKE '%turkey%' OR name ILIKE '%turkish%'
      ORDER BY name
      LIMIT 10;
    `);

    console.log('Turkish competitions:');
    comp.rows.forEach(c => console.log(`  [${c.id.slice(0, 8)}] ${c.name}`));
    console.log('');

    if (comp.rows.length > 0) {
      // Try to find Süper Lig (usually has "1" or "First" in name)
      let superLig = comp.rows.find(c =>
        c.name.includes('1') ||
        c.name.toLowerCase().includes('first') ||
        c.name.toLowerCase().includes('super')
      );

      if (!superLig) superLig = comp.rows[0];

      const compId = superLig.id;
      console.log('Using competition:', superLig.name, '(', compId.slice(0, 8), '...)');
      console.log('');

      // Get standings for this competition
      const standings = await pool.query(`
        SELECT
          s.id,
          s.competition_id,
          s.season_id,
          s.standings,
          s.updated_at
        FROM ts_standings s
        WHERE s.competition_id = $1
        ORDER BY s.updated_at DESC
        LIMIT 1;
      `, [compId]);

      if (standings.rows.length > 0) {
        const standingsData = standings.rows[0].standings;
        console.log('Standings (', standingsData.length, 'teams):');
        console.log('Last updated:', standings.rows[0].updated_at);
        console.log('');

        // Get team names
        const teamIds = standingsData.map((t: any) => t.team_id);
        const teams = await pool.query(`
          SELECT id, name
          FROM ts_teams
          WHERE id = ANY($1::text[])
        `, [teamIds]);

        const teamMap: any = {};
        teams.rows.forEach(t => teamMap[t.id] = t.name);

        // Display standings with team names
        standingsData.slice(0, 18).forEach((team: any) => {
          const teamName = teamMap[team.team_id] || 'Unknown';
          console.log(`${team.position}. ${teamName} - ${team.points} pts (MP:${team.played} W:${team.won} D:${team.drawn} L:${team.lost})`);
        });

        // Now compare with FootyStats data
        console.log('');
        console.log('='.repeat(60));
        console.log('Comparing with FootyStats fs_teams_catalog:');
        console.log('='.repeat(60));

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
        console.log('FootyStats Süper Lig teams (', fsTeams.rows.length, 'teams):');
        fsTeams.rows.forEach((team, idx) => {
          console.log(`  ${idx + 1}. [${team.team_id}] ${team.team_name}`);
        });

      } else {
        console.log('No standings found for competition', compId);
      }
    }

    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
