/**
 * Calculate standings from match results in database
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

async function calculateStandings(seasonId, competitionId) {
    const client = await pool.connect();

    try {
        // Get all finished matches for this season
        const matches = await client.query(`
      SELECT 
        home_team_id, away_team_id,
        home_score_display, away_score_display,
        status_id
      FROM ts_matches
      WHERE season_id = $1 AND status_id = 8
    `, [seasonId]);

        if (matches.rows.length === 0) {
            console.log(`No finished matches for season ${seasonId}`);
            return;
        }

        console.log(`Calculating standings from ${matches.rows.length} matches...`);

        // Build standings
        const standings = {};

        for (const match of matches.rows) {
            const homeId = match.home_team_id;
            const awayId = match.away_team_id;
            const homeScore = parseInt(match.home_score_display) || 0;
            const awayScore = parseInt(match.away_score_display) || 0;

            // Initialize teams
            if (!standings[homeId]) {
                standings[homeId] = { team_id: homeId, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 };
            }
            if (!standings[awayId]) {
                standings[awayId] = { team_id: awayId, played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0, points: 0 };
            }

            // Update stats
            standings[homeId].played++;
            standings[awayId].played++;
            standings[homeId].goals_for += homeScore;
            standings[homeId].goals_against += awayScore;
            standings[awayId].goals_for += awayScore;
            standings[awayId].goals_against += homeScore;

            if (homeScore > awayScore) {
                standings[homeId].won++;
                standings[homeId].points += 3;
                standings[awayId].lost++;
            } else if (homeScore < awayScore) {
                standings[awayId].won++;
                standings[awayId].points += 3;
                standings[homeId].lost++;
            } else {
                standings[homeId].drawn++;
                standings[awayId].drawn++;
                standings[homeId].points += 1;
                standings[awayId].points += 1;
            }
        }

        // Convert to array and sort
        const standingsArray = Object.values(standings)
            .map(s => ({
                ...s,
                goal_diff: s.goals_for - s.goals_against
            }))
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
                return b.goals_for - a.goals_for;
            })
            .map((s, i) => ({ ...s, position: i + 1 }));

        console.log(`Calculated standings for ${standingsArray.length} teams`);

        // Save to database
        await client.query(`
      INSERT INTO ts_standings (id, season_id, competition_id, standings, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, NOW())
      ON CONFLICT (season_id) DO UPDATE SET
        standings = EXCLUDED.standings,
        competition_id = EXCLUDED.competition_id,
        updated_at = NOW()
    `, [seasonId, competitionId, JSON.stringify(standingsArray)]);

        console.log(`✅ Saved standings for season ${seasonId}`);

        // Show top 5
        console.log('\nTop 5:');
        for (const team of standingsArray.slice(0, 5)) {
            const teamName = await client.query(`SELECT name FROM ts_teams WHERE external_id = $1`, [team.team_id]);
            console.log(`${team.position}. ${teamName.rows[0]?.name || team.team_id} - ${team.points} pts (${team.played} P, ${team.won}W ${team.drawn}D ${team.lost}L, GD: ${team.goal_diff})`);
        }

        return standingsArray;

    } finally {
        client.release();
    }
}

async function main() {
    console.log('🏆 Calculating Standings from Match Results...\n');

    const client = await pool.connect();

    try {
        // Get all seasons that have finished matches
        const seasons = await client.query(`
      SELECT DISTINCT m.season_id, m.competition_id, c.name as comp_name, COUNT(*) as match_count
      FROM ts_matches m
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE m.status_id = 8
      GROUP BY m.season_id, m.competition_id, c.name
      HAVING COUNT(*) >= 5
      ORDER BY match_count DESC
      LIMIT 50
    `);

        console.log(`Found ${seasons.rows.length} seasons with 5+ finished matches\n`);

        for (const season of seasons.rows) {
            console.log(`\n=== ${season.comp_name || season.competition_id} ===`);
            await calculateStandings(season.season_id, season.competition_id);
        }

        console.log('\n✅ All standings calculated!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

main();
