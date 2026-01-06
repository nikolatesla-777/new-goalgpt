
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env from specific path on server if possible, otherwise relative
const envPath = '/var/www/goalgpt/.env';
dotenv.config({ path: envPath });

// Fallback if that failed (e.g. running locally)
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const DEFAULT_RULES = [
    {
        bot_display_name: 'Alert System',
        minute_from: null,
        minute_to: null,
        priority: 100, // Highest priority
        is_active: true,
        prediction_type_pattern: 'Manuel'
    },
    {
        bot_display_name: 'Alert D',
        minute_from: 1,
        minute_to: 15,
        priority: 50,
        is_active: true
    },
    {
        bot_display_name: 'Algoritma 01',
        minute_from: 1,
        minute_to: 90,
        priority: 40,
        is_active: true
    },
    {
        bot_display_name: 'Code 35',
        minute_from: 35,
        minute_to: 45,
        priority: 30,
        is_active: true
    },
    {
        bot_display_name: 'Code Zero',
        minute_from: 0,
        minute_to: 90,
        priority: 20,
        is_active: true
    }
];

async function seed() {
    try {
        console.log('Seeding Bot Rules...');

        for (const rule of DEFAULT_RULES) {
            // Check if exists
            const check = await pool.query('SELECT id FROM ai_bot_rules WHERE bot_display_name = $1', [rule.bot_display_name]);
            if (check.rows.length === 0) {
                console.log(`Inserting rule: ${rule.bot_display_name}`);
                await pool.query(`
                    INSERT INTO ai_bot_rules (bot_display_name, minute_from, minute_to, priority, is_active)
                    VALUES ($1, $2, $3, $4, $5)
                `, [rule.bot_display_name, rule.minute_from, rule.minute_to, rule.priority, rule.is_active]);
            } else {
                console.log(`Rule already exists: ${rule.bot_display_name}`);
            }
        }
        console.log('Seeding complete.');
    } catch (e) {
        console.error('Seeding error:', e);
    } finally {
        await pool.end();
    }
}

seed();
