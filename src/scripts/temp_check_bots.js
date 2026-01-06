
const { Pool } = require('pg');
require('dotenv').config();

// Use same config as app
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'goalgpt',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
};

console.log('CONNECTING_CONFIG:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password ? '***' : 'EMPTY'
});

const pool = new Pool(config);

async function run() {
    try {
        const res = await pool.query('SELECT DISTINCT bot_name FROM ai_predictions ORDER BY bot_name');
        console.log('BOTS_DATA:', JSON.stringify(res.rows.map(r => r.bot_name)));

        try {
            const groups = await pool.query('SELECT * FROM prediction_bot_groups');
            console.log('GROUPS_DATA:', JSON.stringify(groups.rows));
        } catch (e) {
            console.log('GROUPS_ERROR: ' + e.message);
        }
    } catch (e) {
        console.error('DB_ERROR:', e);
    } finally {
        pool.end();
    }
}
run();
