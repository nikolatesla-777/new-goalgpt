/**
 * Sync ALL seasons matches from API to database
 * Covers all teams in the database
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const https = require('https');

// Manual env loading
const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});

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

async function syncSeasonMatches(client, seasonId) {
    try {
        const response = await fetchFromApi('/match/season/recent', { uuid: seasonId });

        if (response.err) {
            console.log(`  ❌ API Error: ${response.err}`);
            return { synced: 0, total: 0, error: response.err };
        }

        if (!response.results || !Array.isArray(response.results) || response.results.length === 0) {
            return { synced: 0, total: 0 };
        }

        // Sync teams from results_extra
        if (response.results_extra && response.results_extra.team) {
            const teams = Object.entries(response.results_extra.team);
            for (const [teamId, teamData] of teams) {
                const t = teamData;
                try {
                    await client.query(`
            INSERT INTO ts_teams (id, external_id, name, short_name, logo_url, competition_id, country_id, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (external_id) DO UPDATE SET
              name = COALESCE(EXCLUDED.name, ts_teams.name),
              short_name = COALESCE(EXCLUDED.short_name, ts_teams.short_name),
              logo_url = COALESCE(EXCLUDED.logo_url, ts_teams.logo_url),
              competition_id = COALESCE(EXCLUDED.competition_id, ts_teams.competition_id),
              updated_at = NOW()
          `, [
                        t.id || teamId,
                        t.name || 'Unknown',
                        t.short_name || t.name,
                        t.logo,
                        t.competition_id,
                        t.country_id
                    ]);
                } catch (e) { }
            }
        }

        let synced = 0;

        for (const match of response.results) {
            try {
                const homeScores = Array.isArray(match.home_scores) ? match.home_scores : [];
                const awayScores = Array.isArray(match.away_scores) ? match.away_scores : [];

                await client.query(`
          INSERT INTO ts_matches (
            id, external_id, season_id, competition_id, 
            home_team_id, away_team_id, status_id, match_time,
            venue_id, referee_id, stage_id, round_num, group_num,
            home_scores, away_scores,
            home_score_display, away_score_display,
            home_score_regular, away_score_regular,
            home_red_cards, away_red_cards,
            home_yellow_cards, away_yellow_cards,
            home_corners, away_corners,
            created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3,
            $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14,
            $15, $16,
            $17, $18,
            $19, $20,
            $21, $22,
            $23, $24,
            NOW(), NOW()
          )
          ON CONFLICT (external_id) DO UPDATE SET
            status_id = EXCLUDED.status_id,
            home_scores = EXCLUDED.home_scores,
            away_scores = EXCLUDED.away_scores,
            home_score_display = EXCLUDED.home_score_display,
            away_score_display = EXCLUDED.away_score_display,
            home_score_regular = EXCLUDED.home_score_regular,
            away_score_regular = EXCLUDED.away_score_regular,
            home_red_cards = EXCLUDED.home_red_cards,
            away_red_cards = EXCLUDED.away_red_cards,
            updated_at = NOW()
        `, [
                    match.id,
                    match.season_id,
                    match.competition_id,
                    match.home_team_id,
                    match.away_team_id,
                    match.status_id || 1,
                    match.match_time,
                    match.venue_id,
                    match.referee_id,
                    match.stage_id,
                    match.round?.round_num || match.round_num,
                    match.round?.group_num || match.group_num,
                    JSON.stringify(homeScores),
                    JSON.stringify(awayScores),
                    homeScores[0] ?? null,
                    awayScores[0] ?? null,
                    homeScores[0] ?? null,
                    awayScores[0] ?? null,
                    homeScores[2] ?? null,
                    awayScores[2] ?? null,
                    homeScores[3] ?? null,
                    awayScores[3] ?? null,
                    homeScores[4] ?? null,
                    awayScores[4] ?? null
                ]);

                synced++;
            } catch (e) { }
        }

        return { synced, total: response.results.length };

    } catch (e) {
        return { synced: 0, total: 0, error: e.message };
    }
}

async function main() {
    console.log('🚀 Starting FULL Season Sync for ALL teams...\n');

    const client = await pool.connect();

    try {
        // Get all unique season IDs from existing matches and known seasons
        const seasonsResult = await client.query(`
      SELECT DISTINCT external_id 
      FROM ts_seasons 
      WHERE external_id IS NOT NULL
      LIMIT 200
    `);

        console.log(`Found ${seasonsResult.rows.length} seasons to sync\n`);

        let totalSynced = 0;
        let processedSeasons = 0;

        for (const row of seasonsResult.rows) {
            const seasonId = row.external_id;
            process.stdout.write(`[${++processedSeasons}/${seasonsResult.rows.length}] Season ${seasonId}: `);

            const result = await syncSeasonMatches(client, seasonId);

            if (result.error) {
                console.log(`Error - ${result.error}`);
            } else if (result.total === 0) {
                console.log('No matches');
            } else {
                console.log(`✅ ${result.synced}/${result.total} matches`);
                totalSynced += result.synced;
            }

            // Rate limiting - wait 500ms between API calls
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`\n✅ Total synced: ${totalSynced} matches across ${processedSeasons} seasons`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        pool.end();
    }
}

main();
