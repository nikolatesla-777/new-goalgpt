
import { TheSportsClient } from './src/services/thesports/client/thesports-client';
import { pool } from './src/database/connection';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkMissingLiveMatches() {
    const client = new TheSportsClient();

    console.log('--- FETCHING LIVE MATCHES FROM API ---');
    const apiResponse = await client.get<any>('/match/live');
    const apiMatches = apiResponse.results || [];
    console.log(`API Live Matches: ${apiMatches.length}`);

    console.log('\n--- FETCHING LIVE MATCHES FROM DB ---');
    const dbResult = await pool.query('SELECT external_id, status_id, match_time, home_team_id, away_team_id FROM ts_matches WHERE status_id IN (2, 3, 4, 5, 7)');
    const dbMatches = dbResult.rows || [];
    console.log(`DB Live Matches: ${dbMatches.length}`);

    const dbIds = new Set(dbMatches.map(m => m.external_id));

    const missingInDb = apiMatches.filter((m: any) => !dbIds.has(String(m.id)));

    console.log(`\n--- MISSING IN DB (Live status on API but not live in DB): ${missingInDb.length} ---`);
    for (const m of missingInDb) {
        // Check if it exists in DB with ANY status
        const exists = await pool.query('SELECT external_id, status_id, match_time FROM ts_matches WHERE external_id = $1', [String(m.id)]);
        if (exists.rows.length > 0) {
            console.log(`Match ${m.id}: In DB with status ${exists.rows[0].status_id}, API status ${m.status_id}`);
        } else {
            console.log(`Match ${m.id}: NOT IN DB AT ALL. Start time: ${m.match_time}`);
        }
    }

    process.exit(0);
}

checkMissingLiveMatches().catch(err => {
    console.error(err);
    process.exit(1);
});
