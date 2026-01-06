
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function inspect() {
    try {
        console.log('--- Table: ai_predictions ---');
        const res = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'ai_predictions'
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

inspect();
