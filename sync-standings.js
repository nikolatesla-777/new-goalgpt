/**
 * Sync Turkish Super League Standings for 2024-2025
 * Uses the correct season ID found earlier: 8y39mp1h2djmojx
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Manual env loading
const envPath = path.resolve(__dirname, '.env');
try {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
    });
} catch (e) { }

const API_USER = process.env.THESPORTS_API_USER;
const API_SECRET = process.env.THESPORTS_API_SECRET;
const BASE_URL = 'https://api.thesports.com/v1/football';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

function fetchFromApi(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        params.user = API_USER;
        params.secret = API_SECRET;
        const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
        const url = `${BASE_URL}${endpoint}?${query}`;

        console.log(`Fetching: ${endpoint}...`);

        https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.err) {
                        console.log('API Error:', parsed.err);
                    }
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function syncStandings() {
    const client = await pool.connect();

    try {
        console.log('=== SYNCING TURKISH SUPER LEAGUE STANDINGS ===\n');

        // Known season ID for Turkish Super League 2024-2025
        const seasonId = '8y39mp1h2djmojx';
        const competitionId = '8y39mp1h6jmojxg';

        console.log('Fetching standings for season:', seasonId);

        const tableData = await fetchFromApi('/season/table', { uuid: seasonId });

        console.log('API Response:', JSON.stringify(tableData, null, 2).substring(0, 500));

        if (tableData.results) {
            // Results could be { overall: [...], home: [...], away: [...] } or just an array
            let standingsArray;

            if (Array.isArray(tableData.results)) {
                standingsArray = tableData.results;
            } else if (tableData.results.overall) {
                standingsArray = tableData.results.overall;
            } else if (tableData.results.total) {
                standingsArray = tableData.results.total;
            } else {
                // Try to extract first array from object
                const values = Object.values(tableData.results);
                standingsArray = values.find(v => Array.isArray(v)) || [];
            }

            console.log(`Found ${standingsArray.length} teams in standings`);

            if (standingsArray.length > 0) {
                // Check if already exists
                const existing = await client.query(
                    `SELECT id FROM ts_standings WHERE season_id = $1`,
                    [seasonId]
                );

                if (existing.rows.length === 0) {
                    await client.query(
                        `INSERT INTO ts_standings (id, season_id, competition_id, standings, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
                        [seasonId, competitionId, JSON.stringify(standingsArray)]
                    );
                    console.log('✅ Inserted new standings');
                } else {
                    await client.query(
                        `UPDATE ts_standings 
             SET standings = $1, competition_id = $2, updated_at = NOW() 
             WHERE season_id = $3`,
                        [JSON.stringify(standingsArray), competitionId, seasonId]
                    );
                    console.log('✅ Updated existing standings');
                }

                // Show top 5
                console.log('\nTop 5 teams:');
                standingsArray.slice(0, 5).forEach((t, i) => {
                    console.log(`${i + 1}. ${t.team_id} - Points: ${t.pts || t.points}`);
                });
            }
        } else {
            console.log('No results in API response');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

syncStandings();
