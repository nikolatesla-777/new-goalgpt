
import { pool } from '../database/connection';
import dotenv from 'dotenv';

const envPath = '/var/www/goalgpt/.env';
dotenv.config({ path: envPath });

// Fallback logic for connection
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';
}

async function listRules() {
    try {
        console.log('--- CURRENT BOT RULES ---');
        const result = await pool.query(`
            SELECT id, bot_display_name, bot_group_id, priority, is_active 
            FROM ai_bot_rules 
            ORDER BY priority DESC, bot_display_name ASC
        `);
        console.table(result.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

listRules();
