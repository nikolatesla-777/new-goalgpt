
import { pool } from '../database/connection';
import dotenv from 'dotenv';

const envPath = '/var/www/goalgpt/.env';
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';
}

async function checkSchema() {
    try {
        console.log('--- CHECKING AI_BOT_RULES SCHEMA ---');
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ai_bot_rules'
            ORDER BY column_name;
        `);
        console.table(result.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkSchema();
