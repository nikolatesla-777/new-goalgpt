/**
 * Try standings with correct parameters
 */

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

function fetchFromApi(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        params.user = API_USER;
        params.secret = API_SECRET;
        const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
        const url = `${BASE_URL}${endpoint}?${query}`;

        console.log(`Fetching: ${endpoint} with params:`, Object.keys(params).filter(k => k !== 'user' && k !== 'secret'));

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

async function tryStandingsEndpoints() {
    try {
        console.log('=== TRYING STANDINGS WITH SEASON ID ===\n');

        // Turkish Super League 2024-2025 season ID (found earlier via pagination)
        const seasonId = '8y39mp1h2djmojx';

        // Try with uuid=season_id (as per API docs)
        console.log('\n--- /season/recent/table/detail with uuid=season_id ---');
        const res1 = await fetchFromApi('/season/recent/table/detail', { uuid: seasonId });
        console.log('Response:', JSON.stringify(res1, null, 2).substring(0, 2000));

        // Also try without any params to see what we get
        console.log('\n--- /season/recent/table/detail without params ---');
        const res2 = await fetchFromApi('/season/recent/table/detail', {});
        console.log('Response keys:', Object.keys(res2));
        if (res2.results) {
            if (Array.isArray(res2.results)) {
                console.log('Results count:', res2.results.length);
                console.log('First result sample:', JSON.stringify(res2.results[0], null, 2).substring(0, 500));
            } else {
                console.log('Results type:', typeof res2.results);
                console.log('Results keys:', Object.keys(res2.results));
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

tryStandingsEndpoints();
