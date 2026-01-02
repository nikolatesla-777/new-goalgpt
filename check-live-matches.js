const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const https = require('https');

const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});
const pool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false } });

const API_USER = process.env.THESPORTS_API_USER;
const API_SECRET = process.env.THESPORTS_API_SECRET;
const BASE_URL = 'https://api.thesports.com/v1/football';

function fetchFromApi(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        params.user = API_USER;
        params.secret = API_SECRET;
        const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
        const url = `${BASE_URL}${endpoint}?${query}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

(async () => {
    const client = await pool.connect();

    // 1. Check live matches in DB
    const liveMatches = await client.query(`
    SELECT m.external_id, m.home_team_id, m.away_team_id, m.status_id, m.match_time,
           h.name as home_name, a.name as away_name
    FROM ts_matches m
    LEFT JOIN ts_teams h ON m.home_team_id = h.external_id
    LEFT JOIN ts_teams a ON m.away_team_id = a.external_id
    WHERE m.status_id IN (2, 3, 4, 5, 7)
    ORDER BY m.match_time DESC
  `);

    console.log(`\n=== LIVE MATCHES IN DB (${liveMatches.rows.length}) ===`);
    liveMatches.rows.forEach(m => {
        console.log(`${m.home_name} vs ${m.away_name} (Status: ${m.status_id})`);
    });

    // 2. Check live matches from API
    console.log(`\n=== LIVE MATCHES FROM API ===`);
    const apiResponse = await fetchFromApi('/match/live/list', {});
    console.log(`Total live in API: ${apiResponse.results?.length || 0}`);

    if (apiResponse.results) {
        // Compare
        const dbIds = liveMatches.rows.map(m => m.external_id);
        const missingInDb = apiResponse.results.filter(m => !dbIds.includes(m.id));

        console.log(`\nMissing in DB: ${missingInDb.length}`);
        missingInDb.forEach(m => console.log(`- ${m.id}: ${m.home_team_id} vs ${m.away_team_id}`));
    }

    client.release();
    pool.end();
})();
