import { pool } from '../database/connection';

async function main() {
  console.log('Checking Süper Lig status...\n');

  // Find Süper Lig competition
  const comp = await pool.query(`
    SELECT external_id, name
    FROM ts_competitions
    WHERE external_id = '8y39mp1h6jmojxg'
    LIMIT 1
  `);

  if (comp.rows.length === 0) {
    console.log('Süper Lig not found in database');
    await pool.end();
    process.exit(0);
  }

  console.log(`Competition: ${comp.rows[0].name}`);
  console.log(`External ID: ${comp.rows[0].external_id}\n`);

  // Find 2025-2026 season
  const season = await pool.query(`
    SELECT external_id, year, is_current
    FROM ts_seasons
    WHERE competition_id = $1
      AND (year LIKE '%2025%' OR year LIKE '%2026%')
    ORDER BY year DESC
    LIMIT 1
  `, [comp.rows[0].external_id]);

  if (season.rows.length === 0) {
    console.log('No 2025-2026 season found');
    await pool.end();
    process.exit(0);
  }

  console.log(`Season: ${season.rows[0].year}`);
  console.log(`Season ID: ${season.rows[0].external_id}`);
  console.log(`Is Current: ${season.rows[0].is_current}\n`);

  // Check standings
  const standings = await pool.query(`
    SELECT
      standings,
      updated_at,
      jsonb_array_length(standings) as num_teams
    FROM ts_standings
    WHERE season_id = $1
    LIMIT 1
  `, [season.rows[0].external_id]);

  if (standings.rows.length === 0) {
    console.log('❌ No standings data found for Süper Lig 2025-2026');
  } else {
    const st = standings.rows[0];
    console.log(`✅ Standings found:`);
    console.log(`   Teams: ${st.num_teams}`);
    console.log(`   Last Updated: ${st.updated_at}`);

    // Find Trabzonspor
    const trabzonspor = st.standings.find((team: any) =>
      team.team_id && (
        team.team_id.includes('trabzon') ||
        JSON.stringify(team).toLowerCase().includes('trabzon')
      )
    );

    if (trabzonspor) {
      console.log(`\n🏆 Trabzonspor:`);
      console.log(`   Position: ${trabzonspor.position}`);
      console.log(`   Points: ${trabzonspor.points}`);
      console.log(`   Team ID: ${trabzonspor.team_id}`);
    } else {
      console.log(`\n⚠️  Trabzonspor not found in standings`);
      console.log(`\nTop 5 teams:`);
      st.standings.slice(0, 5).forEach((team: any) => {
        console.log(`   ${team.position}. ${team.team_id} - ${team.points} pts`);
      });
    }

    // Check team name mapping
    console.log(`\n\nChecking team name mapping...`);
    const teamIds = st.standings.slice(0, 10).map((t: any) => t.team_id);
    const teams = await pool.query(`
      SELECT external_id, name
      FROM ts_teams
      WHERE external_id = ANY($1::text[])
    `, [teamIds]);

    console.log(`Found ${teams.rows.length}/${teamIds.length} teams in database:`);
    teams.rows.forEach(team => {
      console.log(`   - ${team.name} (${team.external_id})`);
    });
  }

  await pool.end();
  process.exit(0);
}

main();
