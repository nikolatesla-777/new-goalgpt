const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Manual env loading
const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function debug() {
    const client = await pool.connect();
    try {
        // GS Matches by season/comp
        const res = await client.query(`
      SELECT DISTINCT m.season_id, m.competition_id 
      FROM ts_matches m 
      WHERE m.home_team_id = $1 OR m.away_team_id = $1
    `, ['z318q66hp66qo9j']);
        console.log('GS Matches by Season/Competition:', res.rows);

        // Check if any of these seasons have standings
        for (const row of res.rows) {
            const standCheck = await client.query(`SELECT id FROM ts_standings WHERE season_id = $1`, [row.season_id]);
            console.log(`Season ${row.season_id} has standings: ${standCheck.rows.length > 0}`);
        }

    } finally {
        client.release();
        pool.end();
    }
}

debug();
