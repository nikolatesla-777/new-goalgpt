
const { Pool } = require('pg');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'goalgpt',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
};

const pool = new Pool(config);

async function run() {
    try {
        console.log('--- FIXING BOT NAMES ---');

        // 1. ALERT D
        const res1 = await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'Alert D' 
      WHERE bot_name ILIKE '%Alert D%' OR bot_name = 'ALERT: D'
    `);
        console.log(`Updated Alert D: ${res1.rowCount}`);

        // 2. BOT 007
        const res2 = await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'BOT 007' 
      WHERE bot_name ILIKE '%007%'
    `);
        console.log(`Updated BOT 007: ${res2.rowCount}`);

        // 3. CODE: 35
        const res3 = await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'Code 35' 
      WHERE bot_name ILIKE '%Code%35%'
    `);
        console.log(`Updated Code 35: ${res3.rowCount}`);

        // 4. ALERT SYSTEM (Manuel)
        // Map Manual/Manuel to 'Alert System'
        const res4 = await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'Alert System' 
      WHERE bot_name ILIKE '%Manual%' OR bot_name ILIKE '%Manuel%'
    `);
        console.log(`Updated Alert System (Manuel): ${res4.rowCount}`);

        // 5. Code Zero (Algoritma 01 etc map to Code Zero?)
        // User requested Code Zero. But database has 'Algoritma 01'.
        // If I map Algoritma 01 to Code Zero, history is preserved.
        // Let's assume Algoritma 01 IS Code Zero for now or belongs to it.
        // BUT user screenshot shows "Algoritma 01" separately!
        // So Code Zero might be empty right now or "0 Stats".
        // I will NOT map Algoritma 01 to Code Zero if user lists them separately in screenshot (Wait, user screenshot shows `Active Bot Groups`... `Algoritma 01` is there).
        // So Algoritma 01 -> Algoritma 01. Code Zero -> New/Empty?
        // User list: "CODE ZERO".
        // I will map 'Algoritma 01' to 'Algoritma 01' just to be safe.

        await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'Algoritma 01' 
      WHERE bot_name ILIKE '%Algoritma%01%'
    `);
        console.log('Updated Algoritma 01');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

run();
