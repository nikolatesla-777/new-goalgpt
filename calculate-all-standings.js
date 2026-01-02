/**
 * Calculate ALL standings with team names for every season
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function calculateStandingsForSeason(client, seasonId, competitionId) {
    const matches = await client.query(`
    SELECT home_team_id, away_team_id, home_score_display, away_score_display
    FROM ts_matches
    WHERE season_id = $1 AND status_id = 8
  `, [seasonId]);

    if (matches.rows.length < 5) return null;

    const standings = {};
    for (const m of matches.rows) {
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
    if (teamIds.length === 0) return null;

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
            team_name: teamMap[s.team_id]?.name || null,
            team_logo: teamMap[s.team_id]?.logo_url || null
        }))
        .sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff)
        .map((s, i) => ({ ...s, position: i + 1 }));

    // Save
    await client.query(`
    INSERT INTO ts_standings (id, season_id, competition_id, standings, updated_at)
    VALUES (gen_random_uuid(), $1, $2, $3, NOW())
    ON CONFLICT (season_id) DO UPDATE SET standings = EXCLUDED.standings, competition_id = EXCLUDED.competition_id, updated_at = NOW()
  `, [seasonId, competitionId, JSON.stringify(arr)]);

    return arr.length;
}

async function main() {
    console.log('🏆 Calculating ALL standings with team names...\n');

    const client = await pool.connect();

    try {
        // Get all seasons with 5+ finished matches
        const seasons = await client.query(`
      SELECT DISTINCT m.season_id, m.competition_id, c.name as comp_name, COUNT(*) as match_count
      FROM ts_matches m
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE m.status_id = 8
      GROUP BY m.season_id, m.competition_id, c.name
      HAVING COUNT(*) >= 5
      ORDER BY match_count DESC
    `);

        console.log(`Found ${seasons.rows.length} seasons with 5+ finished matches\n`);

        let processed = 0;
        let totalTeams = 0;

        for (const season of seasons.rows) {
            const count = await calculateStandingsForSeason(client, season.season_id, season.competition_id);
            if (count) {
                totalTeams += count;
                console.log(`✅ ${season.comp_name || season.competition_id}: ${count} teams`);
            }
            processed++;

            if (processed % 10 === 0) {
                console.log(`Progress: ${processed}/${seasons.rows.length}`);
            }
        }

        console.log(`\n✅ Completed! ${processed} seasons, ${totalTeams} total teams`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

main();
