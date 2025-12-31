const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    const client = await pool.connect();
    try {
        const gsId = 'z318q66hp66qo9j';

        // All GS matches
        console.log('=== ALL GALATASARAY MATCHES ===');
        const matches = await client.query(`
      SELECT m.external_id, m.competition_id, m.season_id, m.match_time, m.status_id, c.name as comp_name
      FROM ts_matches m 
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE m.home_team_id = $1 OR m.away_team_id = $1
      ORDER BY m.match_time DESC
    `, [gsId]);

        console.log('Total matches:', matches.rows.length);
        matches.rows.forEach(m => {
            const date = new Date(m.match_time * 1000).toISOString().split('T')[0];
            console.log(`${date} | ${m.comp_name || 'Unknown'} | status: ${m.status_id}`);
        });

        // Competition breakdown
        console.log('\n=== BY COMPETITION ===');
        const byComp = await client.query(`
      SELECT c.name, c.external_id, COUNT(*) as count
      FROM ts_matches m 
      LEFT JOIN ts_competitions c ON m.competition_id = c.external_id
      WHERE m.home_team_id = $1 OR m.away_team_id = $1
      GROUP BY c.name, c.external_id
    `, [gsId]);
        byComp.rows.forEach(r => console.log(r.name, ':', r.count, 'matches'));

        // Check standings table structure
        console.log('\n=== STANDINGS SAMPLE ===');
        const standings = await client.query(`
      SELECT season_id, competition_id, 
             jsonb_array_length(standings::jsonb) as team_count
      FROM ts_standings 
      WHERE standings IS NOT NULL AND standings != '{}'
      LIMIT 5
    `);
        standings.rows.forEach(r => console.log(r));

    } finally {
        client.release();
        pool.end();
    }
}

checkData();
