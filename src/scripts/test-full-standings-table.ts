import { pool } from '../database/connection';

async function main() {
  console.log('📊 FULL STANDINGS TABLE - ALL COLUMNS\n');
  console.log('='.repeat(120));

  const competitionId = '8y39mp1h6jmojxg'; // Süper Lig

  // Get standings
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
    console.log('No standings found');
    await pool.end();
    process.exit(0);
  }

  const rawResponse = standingsResult.rows[0].raw_response;
  const seasonId = standingsResult.rows[0].season_id;
  const rows = rawResponse.results.tables[0].rows;

  // Get team names
  const teamIds = rows.map((row: any) => row.team_id);
  const teamsResult = await pool.query(`
    SELECT external_id, name
    FROM ts_teams
    WHERE external_id = ANY($1::text[])
  `, [teamIds]);

  const teamMap: Record<string, any> = {};
  teamsResult.rows.forEach((team: any) => {
    teamMap[team.external_id] = { name: team.name };
  });

  // Calculate ALL statistics for each team
  const enrichedRows = [];

  for (const row of rows) {
    const teamId = row.team_id;

    // Get last 20 matches for comprehensive statistics
    const matchesResult = await pool.query(`
      SELECT
        home_team_id,
        away_team_id,
        home_score_display,
        away_score_display,
        match_time,
        statistics
      FROM ts_matches
      WHERE (home_team_id = $1 OR away_team_id = $1)
        AND status_id = 8
        AND season_id = $2
      ORDER BY match_time DESC
      LIMIT 20
    `, [teamId, seasonId]);

    const matches = matchesResult.rows;

    // Calculate statistics
    let cleanSheets = 0;
    let bttsCount = 0;
    let over15Count = 0;
    let over25Count = 0;
    let totalGoalsScored = 0;
    let totalGoalsConceded = 0;
    let totalXgFor = 0;
    let xgCount = 0;

    // Last 5 form
    const last5Form: string[] = [];

    matches.forEach((match: any, index: number) => {
      const isHome = match.home_team_id === teamId;
      const teamScore = isHome ? match.home_score_display : match.away_score_display;
      const opponentScore = isHome ? match.away_score_display : match.home_score_display;
      const totalMatchGoals = teamScore + opponentScore;

      // Goals
      totalGoalsScored += teamScore;
      totalGoalsConceded += opponentScore;

      // Clean sheet
      if (opponentScore === 0) {
        cleanSheets++;
      }

      // BTTS
      if (teamScore > 0 && opponentScore > 0) {
        bttsCount++;
      }

      // Over 1.5 total goals
      if (totalMatchGoals > 1) {
        over15Count++;
      }

      // Over 2.5 total goals
      if (totalMatchGoals > 2) {
        over25Count++;
      }

      // xG (from statistics if available)
      if (match.statistics && match.statistics.xg) {
        const xgData = isHome ? match.statistics.xg.home : match.statistics.xg.away;
        if (xgData && typeof xgData === 'number') {
          totalXgFor += xgData;
          xgCount++;
        }
      }

      // Last 5 form
      if (index < 5) {
        if (teamScore > opponentScore) last5Form.push('W');
        else if (teamScore < opponentScore) last5Form.push('L');
        else last5Form.push('D');
      }
    });

    const matchCount = matches.length;

    enrichedRows.push({
      position: row.position,
      team_name: teamMap[teamId]?.name || teamId,
      mp: row.total,
      w: row.won,
      d: row.draw,
      l: row.loss,
      gf: row.goals,
      ga: row.goals_against,
      gd: row.goal_diff,
      pts: row.points,
      last_5: last5Form.reverse().join(' '),
      ppg: row.total > 0 ? (row.points / row.total).toFixed(2) : '0.00',
      cs: matchCount > 0 ? Math.round((cleanSheets / matchCount) * 100) : 0,
      btts: matchCount > 0 ? Math.round((bttsCount / matchCount) * 100) : 0,
      xgf: xgCount > 0 ? (totalXgFor / xgCount).toFixed(2) : 'N/A',
      over_15: matchCount > 0 ? Math.round((over15Count / matchCount) * 100) : 0,
      over_25: matchCount > 0 ? Math.round((over25Count / matchCount) * 100) : 0,
      avg: matchCount > 0 ? (totalGoalsScored / matchCount).toFixed(2) : '0.00'
    });
  }

  // Display table
  console.log('\nSÜPER LIG 2025-2026 STANDINGS (ALL COLUMNS):\n');
  console.log('Pos | Team                  | MP | W  | D | L | GF | GA | GD  | Pts | Last 5      | PPG  | CS% | BTTS% | xGF  | 1.5+% | 2.5+% | AVG');
  console.log('='.repeat(160));

  enrichedRows.forEach((row: any) => {
    const teamName = row.team_name.substring(0, 21).padEnd(21);
    console.log(
      `${String(row.position).padStart(3)} | ` +
      `${teamName} | ` +
      `${String(row.mp).padStart(2)} | ` +
      `${String(row.w).padStart(2)} | ` +
      `${String(row.d).padStart(1)} | ` +
      `${String(row.l).padStart(1)} | ` +
      `${String(row.gf).padStart(2)} | ` +
      `${String(row.ga).padStart(2)} | ` +
      `${String(row.gd).padStart(3)} | ` +
      `${String(row.pts).padStart(3)} | ` +
      `${row.last_5.padEnd(11)} | ` +
      `${row.ppg} | ` +
      `${String(row.cs + '%').padStart(3)} | ` +
      `${String(row.btts + '%').padStart(5)} | ` +
      `${String(row.xgf).padStart(4)} | ` +
      `${String(row.over_15 + '%').padStart(5)} | ` +
      `${String(row.over_25 + '%').padStart(5)} | ` +
      `${row.avg}`
    );
  });

  console.log('='.repeat(160));
  console.log(`\nTotal Teams: ${enrichedRows.length}`);
  console.log(`Last Updated: ${standingsResult.rows[0].updated_at}`);

  await pool.end();
  process.exit(0);
}

main();
