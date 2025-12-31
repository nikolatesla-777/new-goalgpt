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

async function checkStandings() {
    const client = await pool.connect();
    try {
        // Find standings with actual data
        const res = await client.query(`
      SELECT season_id, competition_id, LENGTH(standings::text) as size 
      FROM ts_standings 
      WHERE standings != '{}' AND standings IS NOT NULL
      ORDER BY size DESC 
      LIMIT 10
    `);
        console.log('Standings with data:');
        console.log(res.rows);

        // Check if any contains Galatasaray
        const gsId = 'z318q66hp66qo9j';
        for (const row of res.rows) {
            const standings = await client.query(`SELECT standings FROM ts_standings WHERE season_id = $1`, [row.season_id]);
            const data = standings.rows[0].standings;

            let arr = [];
            if (Array.isArray(data)) {
                arr = data;
            } else if (data && typeof data === 'object') {
                arr = data.overall || data.total || Object.values(data).flat();
            }

            const found = arr.find(t => t.team_id === gsId);
            if (found) {
                console.log(`\n✅ Found Galatasaray in season ${row.season_id}:`, found);
            }
        }

        console.log('\nDone checking.');

    } finally {
        client.release();
        pool.end();
    }
}

checkStandings();
