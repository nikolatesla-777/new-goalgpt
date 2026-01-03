
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        console.log('Searching for "Saudi" in ts_competitions...');
        const query = `
            SELECT id, name, country_id, active 
            FROM ts_competitions 
            WHERE name ILIKE '%Saudi%' 
            LIMIT 10
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
