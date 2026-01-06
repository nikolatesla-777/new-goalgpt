
import { Pool } from 'pg';

const connectionString = 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('--- DB BOT NAMES (NO STATS) ---');
        const result = await pool.query(`
            SELECT bot_name, COUNT(*) as count
            FROM ai_predictions 
            GROUP BY bot_name 
            ORDER BY count DESC
        `);
        console.table(result.rows);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}
check();
