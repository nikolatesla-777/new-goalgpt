const path = require('path');
const fs = require('fs');
const https = require('https');

const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});

const API_USER = process.env.THESPORTS_API_USER;
const API_SECRET = process.env.THESPORTS_API_SECRET;
const BASE_URL = 'https://api.thesports.com/v1/football';

function fetchFromApi(endpoint, params = {}) {
    return new Promise((resolve, reject) => {
        params.user = API_USER;
        params.secret = API_SECRET;
        const query = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
        const url = `${BASE_URL}${endpoint}?${query}`;

        console.log(`Fetching: ${endpoint}`);

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

async function testEndpoints() {
    try {
        // Turkish Super League current season
        // Season IDs we know about:
        // - z8yomo4hn70q0j6 (UEFA CL)  
        // - 4zp5rzgh8xvq82w (TSL 2024-2025?)

        console.log('=== TESTING API ENDPOINTS ===\n');

        // 1. /match/season/recent - should return recent matches for a season
        console.log('--- /match/season/recent (TSL season) ---');
        const seasonRecent = await fetchFromApi('/match/season/recent', {
            uuid: '4zp5rzgh8xvq82w'  // TSL season
        });
        console.log('Code:', seasonRecent.code);
        console.log('Has results:', !!seasonRecent.results);
        console.log('Results count:', seasonRecent.results?.length || 0);
        if (seasonRecent.results?.length > 0) {
            console.log('First match:', JSON.stringify(seasonRecent.results[0], null, 2).substring(0, 300));
        }
        if (seasonRecent.err) console.log('Error:', seasonRecent.err);

        // 2. /match/season/schedule - upcoming matches for a season  
        console.log('\n--- /match/season/schedule (TSL season) ---');
        const seasonSchedule = await fetchFromApi('/match/season/schedule', {
            uuid: '4zp5rzgh8xvq82w'
        });
        console.log('Code:', seasonSchedule.code);
        console.log('Has results:', !!seasonSchedule.results);
        console.log('Results count:', seasonSchedule.results?.length || 0);
        if (seasonSchedule.err) console.log('Error:', seasonSchedule.err);

        // 3. /team/matches - matches for a team
        console.log('\n--- /team/matches (Galatasaray) ---');
        const teamMatches = await fetchFromApi('/team/matches', {
            uuid: 'z318q66hp66qo9j'  // GS team_id
        });
        console.log('Code:', teamMatches.code);
        console.log('Has results:', !!teamMatches.results);
        console.log('Results count:', teamMatches.results?.length || 0);
        if (teamMatches.results?.length > 0) {
            console.log('Sample:', JSON.stringify(teamMatches.results[0], null, 2).substring(0, 300));
        }
        if (teamMatches.err) console.log('Error:', teamMatches.err);

    } catch (error) {
        console.error('Error:', error);
    }
}

testEndpoints();
