
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        console.log('Checking schema for ai_prediction_matches...');
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ai_prediction_matches'
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
