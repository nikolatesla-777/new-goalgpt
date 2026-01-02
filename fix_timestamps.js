const { Pool } = require('pg');
require('dotenv').config();

console.log(`Connecting to database: ${process.env.DB_HOST}`);

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
        console.log('Resetting timestamps for live matches to force refresh...');
        // Reset timestamps for ALL currently live status codes (2,3,4,5,7)
        const res = await pool.query(`
        UPDATE ts_matches 
        SET last_event_ts = 0, provider_update_time = 0 
        WHERE status_id IN (2, 3, 4, 5, 7)
    `);
        console.log(`Successfully reset timestamps for ${res.rowCount} live matches.`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit();
    }
}

run();
