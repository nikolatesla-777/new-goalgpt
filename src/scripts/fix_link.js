
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function fix() {
    try {
        console.log('Fixing Panipi link...');
        const matchId = '4jwq2ghnzwkem0v'; // From debug_panipi output

        const res = await pool.query(`
            UPDATE ai_predictions
            SET match_id = $1
            WHERE home_team_name ILIKE '%Panipi%'
            AND match_id IS NULL
            RETURNING id, bot_name
        `, [matchId]);

        console.log('Updated:', res.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

fix();
