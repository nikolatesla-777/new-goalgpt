
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        const query = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ts_teams'
            ORDER BY ordinal_position
        `;
        const res = await client.query(query);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
