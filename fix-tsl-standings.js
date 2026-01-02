const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});
const pool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();

  // Calculate TSL standings with team names
  const tslSeasonId = '4zp5rzgh8xvq82w';
  const tslCompId = '8y39mp1h6jmojxg';

  const finishedMatches = await client.query(`
    SELECT home_team_id, away_team_id, home_score_display, away_score_display
    FROM ts_matches
    WHERE season_id = $1 AND status_id = 8
  `, [tslSeasonId]);

  console.log('Finished TSL matches:', finishedMatches.rows.length);

  if (finishedMatches.rows.length > 0) {
    const standings = {};
    for (const m of finishedMatches.rows) {
      const hId = m.home_team_id, aId = m.away_team_id;
      const hScore = parseInt(m.home_score_display) || 0;
      const aScore = parseInt(m.away_score_display) || 0;

      if (!standings[hId]) standings[hId] = { team_id: hId, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 };
      if (!standings[aId]) standings[aId] = { team_id: aId, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 };

      standings[hId].played++; standings[aId].played++;
      standings[hId].goals_for += hScore; standings[hId].goals_against += aScore;
      standings[aId].goals_for += aScore; standings[aId].goals_against += hScore;

      if (hScore > aScore) { standings[hId].won++; standings[hId].points += 3; standings[aId].lost++; }
      else if (hScore < aScore) { standings[aId].won++; standings[aId].points += 3; standings[hId].lost++; }
      else { standings[hId].drawn++; standings[aId].drawn++; standings[hId].points++; standings[aId].points++; }
    }

    // Get team names
    const teamIds = Object.keys(standings);
    const placeholders = teamIds.map((_, i) => `$${i + 1}`).join(',');
    const teamsResult = await client.query(
      `SELECT external_id, name, logo_url FROM ts_teams WHERE external_id IN (${placeholders})`,
      teamIds
    );
    const teamMap = {};
    teamsResult.rows.forEach(t => { teamMap[t.external_id] = { name: t.name, logo_url: t.logo_url }; });

    const arr = Object.values(standings)
      .map(s => ({
        ...s,
        goal_diff: s.goals_for - s.goals_against,
        team_name: teamMap[s.team_id]?.name || 'Unknown',
        team_logo: teamMap[s.team_id]?.logo_url || null
      }))
      .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff)
      .map((s, i) => ({ ...s, position: i + 1 }));

    console.log('Calculated', arr.length, 'teams with names');
    console.log('\nFull Table:');
    for (const t of arr) {
      console.log(`${t.position}. ${t.team_name} - ${t.points} pts (O:${t.played} G:${t.won} B:${t.drawn} M:${t.lost} Av:${t.goal_diff})`);
    }

    // Save
    await client.query(`
      INSERT INTO ts_standings (id, season_id, competition_id, standings, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW())
      ON CONFLICT (season_id) DO UPDATE SET standings = EXCLUDED.standings, competition_id = EXCLUDED.competition_id, updated_at = NOW()
    `, [tslSeasonId, tslCompId, JSON.stringify(arr)]);

    console.log('\n✅ Saved TSL standings with team names!');
  }

  client.release();
  pool.end();
})();
