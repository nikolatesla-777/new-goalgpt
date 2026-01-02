const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const https = require('https');

const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
    });
}

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
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

        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function updateLiveMatches() {
    const client = await pool.connect();
    try {
        // 1. Fetch live data
        // detail_live returns score, incidents and stats for matches in last 120 mins
        const response = await fetchFromApi('/match/detail_live', {});

        if (!response || !response.results || !Array.isArray(response.results)) {
            //   console.log('No live data or invalid response');
            return;
        }

        const updates = response.results;
        if (updates.length > 0) {
            console.log(`Received update for ${updates.length} matches at ${new Date().toISOString()}`);
        }

        // 2. Update DB
        for (const match of updates) {
            // Map API status to local status
            // We assume API returns standard status_ids. If necessary, map them.
            // Basic fields to update: status_id, scores, time

            let statusId;
            let homeScores = [];
            let awayScores = [];
            let homeScore = null;
            let awayScore = null;
            let matchTime = null;

            if (match.score && Array.isArray(match.score)) {
                // match.score format: [id, status_id, home_scores, away_scores, time, ?]
                statusId = match.score[1];
                homeScores = match.score[2] || [];
                awayScores = match.score[3] || [];
                matchTime = match.score[4];

                homeScore = homeScores[0];
                awayScore = awayScores[0];
            } else {
                statusId = match.status_id;
                homeScores = match.home_scores || [];
                awayScores = match.away_scores || [];
                homeScore = match.home_score;
                awayScore = match.away_score;
            }

            statusId = parseInt(statusId);

            // LOGGING TO DEBUG SCORE INDEX
            if (match.score && Array.isArray(match.score)) {
                console.log(`Match ${match.id} (Status ${statusId}): Scores:`, JSON.stringify(match.score));
            }

            // CALCULATE SCORE FROM INCIDENTS (Priority Source)
            // TheSports API incident types: 1=Goal, 8=Penalty, 17=Own Goal (Check documentation or logs)
            // Logs show type 1 has home_score/away_score.
            let incHomeScore = -1;
            let incAwayScore = -1;

            if (match.incidents && Array.isArray(match.incidents)) {
                for (const inc of match.incidents) {
                    if (inc.type === 1 || inc.type === 8 || inc.type === 17) {
                        // Use the highest score found in incidents as the current score
                        if (inc.home_score !== undefined && inc.home_score > incHomeScore) incHomeScore = inc.home_score;
                        if (inc.away_score !== undefined && inc.away_score > incAwayScore) incAwayScore = inc.away_score;
                    }
                }
            }

            // Override homeScore/awayScore if incidents show a higher score (or different)
            // Only override if incidents provided a score (>-1)
            // If API main score is 0-0 but incidents say 0-1, use 0-1.
            if (incHomeScore > -1 && incHomeScore > (homeScore || 0)) {
                homeScore = incHomeScore;
            }
            if (incAwayScore > -1 && incAwayScore > (awayScore || 0)) {
                awayScore = incAwayScore;
            }

            if (isNaN(statusId)) {
                continue;
            }

            const hScore = homeScore !== undefined && homeScore !== null ? String(homeScore) : '0';
            const aScore = awayScore !== undefined && awayScore !== null ? String(awayScore) : '0';

            // Also update regular score for sorting if match is live
            try {
                await client.query(`
                    UPDATE ts_matches SET
                    status_id = $1,
                    home_score_display = $2,
                    away_score_display = $3,
                    home_score_regular = $4,
                    away_score_regular = $5,
                    home_scores = $6,
                    away_scores = $7,
                    updated_at = NOW()
                    WHERE external_id = $8
                `, [
                    statusId,
                    parseInt(hScore), // Display (Integer usually)
                    parseInt(aScore),
                    parseInt(hScore), // Regular (Use live score as regular score during match)
                    parseInt(aScore),
                    JSON.stringify(homeScores),
                    JSON.stringify(awayScores),
                    String(match.id)
                ]);
            } catch (err) {
                console.error('Update error:', err.message);
            }
        }
    } catch (error) {
        console.error('Update error:', error.message);
    } finally {
        client.release();
    }
}

// Run every 2 seconds
console.log('Starting Live Score Daemon...');
setInterval(updateLiveMatches, 2000);

// Initial run
updateLiveMatches();
