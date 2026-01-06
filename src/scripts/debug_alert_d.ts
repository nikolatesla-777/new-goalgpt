
import { pool } from '../database/connection';
import dotenv from 'dotenv';

const envPath = '/var/www/goalgpt/.env';
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';
}

async function debug() {
    try {
        console.log('--- DEBUG ALERT D ---');
        const result = await pool.query(`
            SELECT 
                p.external_id,
                p.prediction_type,
                p.prediction_value,
                m.status_id,
                m.home_score_regular,
                m.away_score_regular,
                m.home_scores,
                m.away_scores
            FROM ai_predictions p
            LEFT JOIN ts_matches m ON p.external_id = m.external_id
            WHERE p.bot_name LIKE '%ALERT%' OR p.bot_name LIKE '%Alert%'
            LIMIT 20
        `);

        console.table(result.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

debug();
