
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        console.log('Searching for "Saudi" in ts_competitions...');
        const query = `
            SELECT * 
            FROM ts_competitions 
            WHERE name ILIKE '%Saudi%' 
            LIMIT 10
        `;
        const res = await client.query(query);
        console.log(`Found ${res.rows.length} competitions:`);
        res.rows.forEach(r => console.log(JSON.stringify(r)));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
