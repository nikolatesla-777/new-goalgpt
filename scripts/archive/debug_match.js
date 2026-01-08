const { Pool } = require('pg');

const connectionString = 'postgres://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Querying match...');
        const res = await pool.query("SELECT * FROM ts_matches WHERE external_id = '965mkyhk4e0wr1g'");
        if (res.rows.length > 0) {
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('Match not found');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
