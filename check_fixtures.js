const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Searching for Galatasaray...');
        const teamRes = await pool.query("SELECT external_id, name FROM ts_teams WHERE name ILIKE '%Galatasaray%' LIMIT 1");

        if (teamRes.rows.length === 0) {
            console.log('Team not found');
            return;
        }

        const team = teamRes.rows[0];
        console.log(`Found team: ${team.name} (${team.external_id})`);

        console.log('Checking competitions for this team in matches...');
        const compRes = await pool.query(`
        SELECT DISTINCT m.competition_id, c.name
        FROM ts_matches m
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        WHERE m.home_team_id = $1 OR m.away_team_id = $1
    `, [team.external_id]);

        console.log('Competitions found in DB fixtures:');
        compRes.rows.forEach(row => {
            console.log(`- ${row.name} (ID: ${row.competition_id})`);
        });

        // Check pending matches (status not 8)
        const pendingRes = await pool.query(`
        SELECT m.match_time, m.competition_id, c.name, ht.name as home, at.name as away
        FROM ts_matches m
        LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
        LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
        LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
        WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
          AND m.status_id != 8
          AND m.match_time > EXTRACT(EPOCH FROM NOW())
        ORDER BY m.match_time ASC
        LIMIT 10
    `, [team.external_id]);

        console.log('\nUpcoming matches in DB:');
        pendingRes.rows.forEach(m => {
            const date = new Date(m.match_time * 1000).toISOString();
            console.log(`[${date}] ${m.home} vs ${m.away} (${m.name})`);
        });

    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

run();
