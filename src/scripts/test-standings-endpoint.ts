import { pool } from '../database/connection';

async function main() {
  console.log('🧪 TESTING ADMIN STANDINGS ENDPOINT LOGIC\n');
  console.log('='.repeat(80));

  const competitionId = '8y39mp1h6jmojxg'; // Süper Lig

  try {
    // Get standings from database
    const standingsResult = await pool.query(`
      SELECT st.raw_response, st.updated_at, s.external_id as season_id
      FROM ts_standings st
      INNER JOIN ts_seasons s ON st.season_id = s.external_id
      WHERE s.competition_id = $1
        AND (s.year LIKE '%2025%' OR s.year LIKE '%2026%')
      ORDER BY st.updated_at DESC
      LIMIT 1
    `, [competitionId]);

    if (standingsResult.rows.length === 0) {
      console.log('❌ Standings not found');
      await pool.end();
      process.exit(1);
    }

    const rawResponse = standingsResult.rows[0].raw_response;
    const seasonId = standingsResult.rows[0].season_id;
    const updatedAt = standingsResult.rows[0].updated_at;

    console.log(`Season ID: ${seasonId}`);
    console.log(`Updated At: ${updatedAt}\n`);

    if (!rawResponse.results?.tables?.[0]?.rows) {
      console.log('❌ Invalid data structure');
      await pool.end();
      process.exit(1);
    }

    const rows = rawResponse.results.tables[0].rows;
    console.log(`✅ Found ${rows.length} teams\n`);

    // Get team names
    const teamIds = rows.map((row: any) => row.team_id);
    const teamsResult = await pool.query(`
      SELECT external_id, name
      FROM ts_teams
      WHERE external_id = ANY($1::text[])
    `, [teamIds]);

    const teamMap: Record<string, string> = {};
    teamsResult.rows.forEach((team: any) => {
      teamMap[team.external_id] = team.name;
    });

    // Get last 5 matches for first 3 teams
    console.log('Last 5 Form Calculation:\n');

    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const teamId = rows[i].team_id;
      const teamName = teamMap[teamId] || teamId;

      const matchesResult = await pool.query(`
        SELECT
          home_team_id,
          away_team_id,
          home_score_display,
          away_score_display,
          match_time
        FROM ts_matches
        WHERE (home_team_id = $1 OR away_team_id = $1)
          AND status_id = 8
          AND season_id = $2
        ORDER BY match_time DESC
        LIMIT 5
      `, [teamId, seasonId]);

      const form = matchesResult.rows.map((match: any) => {
        const isHome = match.home_team_id === teamId;
        const teamScore = isHome ? match.home_score_display : match.away_score_display;
        const opponentScore = isHome ? match.away_score_display : match.home_score_display;

        if (teamScore > opponentScore) return 'W';
        if (teamScore < opponentScore) return 'L';
        return 'D';
      });

      console.log(`${i + 1}. ${teamName}: ${form.reverse().join(' ')}`);
    }

    // Display final table format
    console.log('\n' + '='.repeat(80));
    console.log('FINAL TABLE (Top 5):\n');
    console.log('Pos | Team                     | MP | W  | D | L | GF | GA | GD  | Pts | PPG  | Last 5');
    console.log('-'.repeat(80));

    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      const teamName = (teamMap[row.team_id] || row.team_id).substring(0, 24).padEnd(24);
      const ppg = row.total > 0 ? (row.points / row.total).toFixed(2) : '0.00';

      // Get last 5
      const matchesResult = await pool.query(`
        SELECT home_team_id, away_team_id, home_score_display, away_score_display
        FROM ts_matches
        WHERE (home_team_id = $1 OR away_team_id = $1)
          AND status_id = 8
          AND season_id = $2
        ORDER BY match_time DESC
        LIMIT 5
      `, [row.team_id, seasonId]);

      const form = matchesResult.rows.map((match: any) => {
        const isHome = match.home_team_id === row.team_id;
        const teamScore = isHome ? match.home_score_display : match.away_score_display;
        const opponentScore = isHome ? match.away_score_display : match.home_score_display;
        if (teamScore > opponentScore) return 'W';
        if (teamScore < opponentScore) return 'L';
        return 'D';
      }).reverse().join(' ');

      console.log(
        `${String(row.position).padStart(3)} | ` +
        `${teamName} | ` +
        `${String(row.total).padStart(2)} | ` +
        `${String(row.won).padStart(2)} | ` +
        `${String(row.draw).padStart(1)} | ` +
        `${String(row.loss).padStart(1)} | ` +
        `${String(row.goals).padStart(2)} | ` +
        `${String(row.goals_against).padStart(2)} | ` +
        `${String(row.goal_diff).padStart(3)} | ` +
        `${String(row.points).padStart(3)} | ` +
        `${ppg} | ` +
        `${form}`
      );
    }

    console.log('='.repeat(80));

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    if (err.stack) console.error(err.stack);
  }

  await pool.end();
  process.exit(0);
}

main();
