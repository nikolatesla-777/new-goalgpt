import { theSportsAPI } from '../core/TheSportsAPIManager';
import { pool } from '../database/connection';

async function main() {
  console.log('🏆 UPDATING SÜPER LIG STANDINGS\n');
  console.log('='.repeat(80));

  const superligCompId = '8y39mp1h6jmojxg';
  const superligSeasonId = '4zp5rzgh8xvq82w';

  console.log('Competition: Turkish Super League');
  console.log(`Competition ID: ${superligCompId}`);
  console.log(`Season ID: ${superligSeasonId}\n`);

  // Fetch fresh standings
  console.log('Fetching standings from TheSports API...');
  const standings = await theSportsAPI.get('/season/recent/table/detail', {
    uuid: superligSeasonId
  });

  if (!standings.results || !standings.results.tables || standings.results.tables.length === 0) {
    console.log('❌ No standings data received');
    await pool.end();
    process.exit(1);
  }

  const table = standings.results.tables[0];
  const rows = table.rows || [];

  console.log(`✅ Received ${rows.length} teams\n`);

  // Save to database
  console.log('Saving to database...');
  await pool.query(`
    INSERT INTO ts_standings (season_id, standings, raw_response, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (season_id)
    DO UPDATE SET
      standings = EXCLUDED.standings,
      raw_response = EXCLUDED.raw_response,
      updated_at = NOW()
  `, [superligSeasonId, JSON.stringify(rows), JSON.stringify(standings)]);

  console.log('✅ Saved to database\n');

  // Verify and show results
  console.log('='.repeat(80));
  console.log('VERIFICATION:\n');

  const verify = await pool.query(`
    SELECT standings, updated_at
    FROM ts_standings
    WHERE season_id = $1
  `, [superligSeasonId]);

  if (verify.rows.length > 0) {
    const st = verify.rows[0];
    console.log(`Last Updated: ${st.updated_at}\n`);

    // Get team names for top 10
    const teamIds = st.standings.slice(0, 10).map((t: any) => t.team_id);
    const teams = await pool.query(`
      SELECT external_id, name
      FROM ts_teams
      WHERE external_id = ANY($1::text[])
    `, [teamIds]);

    const teamMap: any = {};
    teams.rows.forEach((t: any) => teamMap[t.external_id] = t.name);

    console.log('TOP 10 STANDINGS:');
    console.log('-'.repeat(80));

    st.standings.slice(0, 10).forEach((team: any) => {
      const name = teamMap[team.team_id] || team.team_id;
      const trabzonFlag = team.team_id === 'kn54qllhy0dqvy9' ? ' 🔵⚪🔴' : '';
      console.log(`${String(team.position).padStart(2)}. ${name.padEnd(30)} ${String(team.points).padStart(2)} pts${trabzonFlag}`);
    });

    // Highlight Trabzonspor
    const trabzonspor = st.standings.find((t: any) => t.team_id === 'kn54qllhy0dqvy9');
    if (trabzonspor) {
      console.log('\n' + '='.repeat(80));
      console.log('🏆 TRABZONSPOR:');
      console.log(`   Position: ${trabzonspor.position}`);
      console.log(`   Points: ${trabzonspor.points}`);
      console.log(`   Goals For: ${trabzonspor.goals_for}`);
      console.log(`   Goals Against: ${trabzonspor.goals_against}`);
      console.log('='.repeat(80));
    }
  }

  await pool.end();
  process.exit(0);
}

main();
