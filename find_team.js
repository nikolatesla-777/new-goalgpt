const { Pool } = require('pg');

const connectionString = 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Querying team...');
        const res = await pool.query("SELECT * FROM ts_teams WHERE name ILIKE '%Sunderland%'");
        if (res.rows.length > 0) {
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('Team not found');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
