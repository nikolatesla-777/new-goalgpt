import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function main() {
  console.log('📊 CHECKING DATABASE STANDINGS');
  console.log('='.repeat(80));
  console.log('');

  try {
    // 1. Check ts_standings table structure
    const tableInfo = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'ts_standings'
      ORDER BY ordinal_position;
    `);

    console.log('Table Structure:');
    tableInfo.rows.forEach((col: any) => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    console.log('');

    // 2. Check recent standings
    const standings = await pool.query(`
      SELECT
        id,
        competition_id,
        season_id,
        CASE
          WHEN jsonb_typeof(standings) = 'array' THEN jsonb_array_length(standings)
          ELSE 0
        END as team_count,
        jsonb_typeof(standings) as standings_type,
        updated_at
      FROM ts_standings
      ORDER BY updated_at DESC
      LIMIT 10;
    `);

    console.log('Recent Standings (Last 10):');
    standings.rows.forEach((row: any, idx: number) => {
      console.log(`  ${idx + 1}. CompID: ${row.competition_id?.slice(0, 15)}... | Season: ${row.season_id?.slice(0, 15)}... | Teams: ${row.team_count} | Updated: ${row.updated_at}`);
    });
    console.log('');

    // 3. Find Süper Lig standings
    const superLigComp = await pool.query(`
      SELECT external_id, name
      FROM ts_competitions
      WHERE external_id = '8y39mp1h6jmojxg'
      LIMIT 1;
    `);

    if (superLigComp.rows.length > 0) {
      console.log(`✅ Found Süper Lig: ${superLigComp.rows[0].name}`);
      console.log('');

      // Get its standings
      const superLigStandings = await pool.query(`
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
      `, [superLigComp.rows[0].external_id]);

      if (superLigStandings.rows.length > 0) {
        const standingsData = superLigStandings.rows[0].standings;
        console.log('Süper Lig Standings:');
        console.log(`  Last Updated: ${superLigStandings.rows[0].updated_at}`);
        console.log(`  Teams: ${standingsData.length}`);
        console.log('');

        // Get team names
        const teamIds = standingsData.map((t: any) => t.team_id);
        const teams = await pool.query(`
          SELECT external_id, name
          FROM ts_teams
          WHERE external_id = ANY($1::text[])
        `, [teamIds]);

        const teamMap: any = {};
        teams.rows.forEach(t => teamMap[t.external_id] = t.name);

        console.log('Top 10:');
        standingsData.slice(0, 10).forEach((team: any) => {
          const teamName = teamMap[team.team_id] || 'Unknown';
          const isTrabzon = teamName.toLowerCase().includes('trabzon');
          const prefix = isTrabzon ? '👉' : '  ';

          console.log(`${prefix} ${team.position}. ${teamName} - ${team.points} pts (MP:${team.played} GD:${team.goal_diff})`);
        });
      } else {
        console.log('❌ No standings found for Süper Lig');
      }
    } else {
      console.log('❌ Süper Lig competition not found in database');
    }

    console.log('');
    console.log('='.repeat(80));

    // 4. Check how many competitions have standings
    const compWithStandings = await pool.query(`
      SELECT COUNT(DISTINCT competition_id) as count
      FROM ts_standings;
    `);

    console.log(`Total competitions with standings: ${compWithStandings.rows[0].count}`);

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

main();
