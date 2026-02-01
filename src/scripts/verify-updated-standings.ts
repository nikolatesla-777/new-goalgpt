import { pool } from '../database/connection';

async function main() {
  console.log('Verifying recently updated standings...\n');

  // Check the 6 leagues that were just updated
  const result = await pool.query(`
    SELECT
      st.season_id,
      c.name as competition_name,
      s.year,
      jsonb_array_length(st.standings) as num_teams,
      st.updated_at
    FROM ts_standings st
    INNER JOIN ts_seasons s ON st.season_id = s.external_id
    LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
    WHERE st.updated_at >= NOW() - INTERVAL '5 minutes'
    ORDER BY st.updated_at DESC
  `);

  console.log(`Found ${result.rows.length} recently updated standings:\n`);

  result.rows.forEach((row, idx) => {
    console.log(`${idx + 1}. ${row.competition_name} (${row.year})`);
    console.log(`   Teams: ${row.num_teams}`);
    console.log(`   Updated: ${row.updated_at}`);
    console.log('');
  });

  // Show sample standings data from Italian Serie B
  console.log('Sample: Italian Serie B top 5 teams:');
  console.log('='.repeat(60));

  const serieB = await pool.query(`
    SELECT st.standings
    FROM ts_standings st
    INNER JOIN ts_seasons s ON st.season_id = s.external_id
    LEFT JOIN ts_competitions c ON s.competition_id = c.external_id
    WHERE c.name = 'Italian Serie B'
      AND st.updated_at >= NOW() - INTERVAL '5 minutes'
    LIMIT 1
  `);

  if (serieB.rows.length > 0) {
    const standings = serieB.rows[0].standings;
    standings.slice(0, 5).forEach((team: any) => {
      console.log(`${team.position}. ${team.team_id} - ${team.points} pts (${team.wins}W ${team.draws}D ${team.losses}L)`);
    });
  }

  await pool.end();
  process.exit(0);
}

main();
