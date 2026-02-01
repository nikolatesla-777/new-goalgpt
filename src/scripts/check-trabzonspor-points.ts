import { pool } from '../database/connection';

async function main() {
  console.log('Checking Trabzonspor points in Süper Lig...\n');

  // Get Süper Lig standings
  const result = await pool.query(`
    SELECT st.standings, st.updated_at
    FROM ts_standings st
    INNER JOIN ts_seasons s ON st.season_id = s.external_id
    WHERE s.competition_id = '8y39mp1h6jmojxg'
      AND s.year = '2025-2026'
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('No standings found');
    await pool.end();
    process.exit(0);
  }

  const standings = result.rows[0].standings;
  const updatedAt = result.rows[0].updated_at;

  console.log(`Last Updated: ${updatedAt}\n`);

  // Find Trabzonspor (external_id: kn54qllhy0dqvy9)
  const trabzonspor = standings.find((team: any) => team.team_id === 'kn54qllhy0dqvy9');

  if (trabzonspor) {
    console.log('🏆 Trabzonspor:');
    console.log(`   Position: ${trabzonspor.position}`);
    console.log(`   Points: ${trabzonspor.points}`);
    console.log(`   Wins: ${trabzonspor.wins}`);
    console.log(`   Draws: ${trabzonspor.draws}`);
    console.log(`   Losses: ${trabzonspor.losses}`);
    console.log(`   Goals For: ${trabzonspor.goals_for}`);
    console.log(`   Goals Against: ${trabzonspor.goals_against}`);
    console.log(`   Goal Difference: ${trabzonspor.goal_difference}`);
  } else {
    console.log('❌ Trabzonspor not found');
  }

  console.log('\n\nTop 10 teams:');
  console.log('='.repeat(60));

  // Get team names
  const teamIds = standings.slice(0, 10).map((t: any) => t.team_id);
  const teams = await pool.query(`
    SELECT external_id, name
    FROM ts_teams
    WHERE external_id = ANY($1::text[])
  `, [teamIds]);

  const teamMap: any = {};
  teams.rows.forEach((t: any) => teamMap[t.external_id] = t.name);

  standings.slice(0, 10).forEach((team: any) => {
    const name = teamMap[team.team_id] || team.team_id;
    console.log(`${team.position}. ${name.padEnd(25)} ${team.points} pts (${team.wins}W ${team.draws}D ${team.losses}L)`);
  });

  await pool.end();
  process.exit(0);
}

main();
