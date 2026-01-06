
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
        console.log('Searching for PREDICTION Panipi...');
        // Find the prediction
        const predRes = await pool.query(`
            SELECT 
                p.id, p.bot_name, p.match_id, p.home_team_name, p.away_team_name,
                p.match_status, p.created_at
            FROM ai_predictions p
            WHERE p.home_team_name ILIKE '%Panipi%'
            OR p.away_team_name ILIKE '%Panipi%'
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (predRes.rows.length === 0) {
            console.log('Prediction not found!');
        } else {
            console.log('Prediction Data:', JSON.stringify(predRes.rows[0], null, 2));
            const matchId = predRes.rows[0].match_id;
            console.log('Linked Match ID:', matchId);

            if (matchId) {
                // Check if match exists and has minute
                const matchRes = await pool.query(`
                    SELECT external_id, minute, status_id, home_team_id 
                    FROM ts_matches WHERE external_id = $1
                `, [matchId]);
                console.log('Match Data:', matchRes.rows[0]);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
