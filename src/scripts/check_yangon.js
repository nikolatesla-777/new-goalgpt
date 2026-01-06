
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function check() {
    try {
        console.log('Searching for Teams (Yangon / Mahar)...');

        const teams = await pool.query(`
            SELECT external_id, name, short_name 
            FROM ts_teams 
            WHERE name ILIKE '%Yangon%' 
               OR name ILIKE '%Mahar%'
        `);
        console.table(teams.rows);

        console.log('\nSearching for Matches...');
        const matches = await pool.query(`
            SELECT m.external_id, m.match_time, m.status_id, 
                   th.name as home, ta.name as away
            FROM ts_matches m
            JOIN ts_teams th ON m.home_team_id = th.external_id
            JOIN ts_teams ta ON m.away_team_id = ta.external_id
            WHERE th.name ILIKE '%Yangon%' OR ta.name ILIKE '%Yangon%'
               OR th.name ILIKE '%Mahar%' OR ta.name ILIKE '%Mahar%'
            ORDER BY m.match_time DESC
            LIMIT 5
        `);
        console.table(matches.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
