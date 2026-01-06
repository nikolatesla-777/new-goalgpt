
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();

        console.log('Fetching one country row to see columns...');
        const res = await client.query('SELECT * FROM ts_countries LIMIT 1');

        if (res.rows.length === 0) {
            console.log('No countries found.');
        } else {
            console.log('Columns available in ts_countries:', Object.keys(res.rows[0]));
            console.log('Example row:', res.rows[0]);
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkSchema();
