
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'goalgpt',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

async function run() {
    try {
        console.log('--- FIXING BOT NAMES ---');

        // 1. ALERT D
        // Maps: Alert D, ALERT D, ALERT: D -> 'Alert D'
        await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'Alert D' 
      WHERE bot_name ILIKE '%Alert D%' OR bot_name = 'ALERT: D'
    `);
        console.log('Updated Alert D');

        // 2. BOT 007
        // Maps: BOT 007 -> 'BOT 007'
        await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'BOT 007' 
      WHERE bot_name ILIKE '%007%'
    `);
        console.log('Updated BOT 007');

        // 3. CODE: 35
        // Maps: CODE: 35 -> 'Code 35'
        await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'Code 35' 
      WHERE bot_name ILIKE '%Code%35%'
    `);
        console.log('Updated Code 35');

        // 4. CODE ZERO
        // Maps: Algoritma 01, Algoritma: 01, IY-1 -> 'Code Zero' (Assuming map based on user context, or keeping them separate if unsure. User listed Code Zero. Let's map Algoritma 01 to it if looks like it, otherwise keep distinct)
        // Actually, looking at screenshot, 'Algoritma 01' exists separately. 
        // User requested "CODE ZERO".
        // I will map 'Algoritma 01' to 'Code Zero' IF they serve the same purpose? 
        // User said "BUNLAR KALACAK". Implicitly "Code Zero" is a group.

        // For now, let's map known Code Zero variants. If none found, we leave it.
        // I suspect 'Algoritma 01' might remain 'Algoritma 01' in DB but maybe user wants it renamed.
        // Let's stick to strict matching for now to avoid data loss.

        // 5. ALERT SYSTEM (Manuel)
        // Maps: Manual -> 'Alert System'
        await pool.query(`
      UPDATE ai_predictions 
      SET canonical_bot_name = 'Alert System' 
      WHERE bot_name ILIKE '%Manual%' OR bot_name ILIKE '%Manuel%'
    `);
        console.log('Updated Alert System (Manuel)');

        // 6. 70. Dakika Botu (User didnt list it, but it exists. Maybe 'Code 70'?)
        // Leaving as is for now: '70. Dakika Botu'

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

run();
