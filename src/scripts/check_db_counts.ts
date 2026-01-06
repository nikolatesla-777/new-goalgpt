
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env from one level up (since we are in src/scripts) or root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('Checking DB Counts...');

        const rules = await pool.query('SELECT COUNT(*) FROM ai_bot_rules');
        console.log('Rules Count:', rules.rows[0].count);

        const predictions = await pool.query('SELECT COUNT(*) FROM ai_predictions');
        console.log('Predictions Count (Total):', predictions.rows[0].count);

        const recentPredictions = await pool.query("SELECT COUNT(*) FROM ai_predictions WHERE created_at > NOW() - INTERVAL '30 days'");
        console.log('Predictions Count (Last 30 Days):', recentPredictions.rows[0].count);

        if (parseInt(rules.rows[0].count) === 0) {
            console.log('Rules table is empty. Suggest seeding.');
        }

        const sample = await pool.query('SELECT bot_name, created_at FROM ai_predictions ORDER BY created_at DESC LIMIT 5');
        console.log('Recent 5 Predictions:', sample.rows);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

check();
