const { Pool } = require('pg');

const connectionString = 'postgres://postgres.wakbsxzocfpngywyzdml:[PASSWORD]@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query("SELECT name, external_id, competition_id FROM ts_teams WHERE name ILIKE '%Sunderland%' OR name ILIKE '%Leeds United%'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
