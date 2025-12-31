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

async function checkTSL() {
    const client = await pool.connect();
    try {
        const tslCompId = '8y39mp1h6jmojxg'; // Turkish Super League

        // All TSL matches
        console.log('=== TURKISH SUPER LEAGUE MATCHES ===');
        const tslMatches = await client.query(`
      SELECT COUNT(*), 
             MIN(match_time) as earliest, 
             MAX(match_time) as latest
      FROM ts_matches 
      WHERE competition_id = $1
    `, [tslCompId]);

        const earliest = new Date(tslMatches.rows[0].earliest * 1000).toISOString();
        const latest = new Date(tslMatches.rows[0].latest * 1000).toISOString();
        console.log('Total TSL matches:', tslMatches.rows[0].count);
        console.log('Earliest:', earliest);
        console.log('Latest:', latest);

        // Sample recent matches
        console.log('\n=== RECENT TSL MATCHES (Last 10) ===');
        const recentTSL = await client.query(`
      SELECT m.external_id, m.match_time, m.status_id,
             ht.name as home_team, at.name as away_team,
             m.home_scores, m.away_scores
      FROM ts_matches m
      LEFT JOIN ts_teams ht ON m.home_team_id = ht.external_id
      LEFT JOIN ts_teams at ON m.away_team_id = at.external_id
      WHERE m.competition_id = $1
      ORDER BY m.match_time DESC
      LIMIT 10
    `, [tslCompId]);

        recentTSL.rows.forEach(m => {
            const date = new Date(m.match_time * 1000).toISOString().split('T')[0];
            const score = m.home_scores ? `${m.home_scores[0] || 0}-${m.away_scores[0] || 0}` : '?-?';
            console.log(`${date} | ${m.home_team} ${score} ${m.away_team} | status: ${m.status_id}`);
        });

        // Check 2024-2025 season specifically
        console.log('\n=== 2024-2025 SEASON CHECK ===');
        const seasonCheck = await client.query(`
      SELECT s.external_id, s.name, COUNT(m.id) as match_count
      FROM ts_seasons s
      LEFT JOIN ts_matches m ON m.season_id = s.external_id
      WHERE s.name ILIKE '%2024%' OR s.name ILIKE '%2025%'
      GROUP BY s.external_id, s.name
      ORDER BY match_count DESC
      LIMIT 20
    `);

        seasonCheck.rows.forEach(s => {
            console.log(`${s.name} (${s.external_id}): ${s.match_count} matches`);
        });

    } finally {
        client.release();
        pool.end();
    }
}

checkTSL();
