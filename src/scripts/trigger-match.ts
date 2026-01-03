
import { pool } from '../database/connection';
import { AIPredictionService } from '../services/ai/aiPrediction.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';

async function main() {
    const client = await pool.connect();
    try {
        console.log('Checking for match at time 1767461400...');
        const matchQuery = `
            SELECT m.id, m.external_id, m.match_time, t1.name as home, t2.name as away
            FROM ts_matches m
            LEFT JOIN ts_teams t1 ON m.home_team_id = t1.external_id
            LEFT JOIN ts_teams t2 ON m.away_team_id = t2.external_id
            WHERE m.match_time = 1767461400
        `;
        const matches = await client.query(matchQuery);
        console.log(`Found ${matches.rows.length} matches:`);
        matches.rows.forEach(r => console.log(JSON.stringify(r)));

        if (matches.rows.length > 0) {
            const predId = 'ab7f0bba-7307-49cf-a30d-d818fc5463ff'; // Known failure
            console.log(`Triggering specific match for prediction ${predId}...`);

            // Setup services
            const tsClient = new TheSportsClient();
            const teamService = new TeamDataService(tsClient);
            const compService = new CompetitionService(tsClient);
            const predService = new AIPredictionService(teamService);

            // Call matchPrediction (assuming public method exists or similar logic)
            // AIPredictionService has `processNewPrediction` but that inserts.
            // It works by finding match first.
            // We can manually insert into ai_prediction_matches if we want, or call the matcher logic.
            // Actually, AIPredictionService has `findMatchingMatch`. 

            const match = await predService.findMatchingMatch(
                'Al Ittihad Jeddah',
                'Al Taawon', // Shortened for safety, or use full 'Al Taawon Buraidah'
                matches.rows[0].match_time * 1000 // Expects ms?
            );
            // Wait, findMatchingMatch takes prediction details.

            console.log('Manual findMatchingMatch result:', match);

            if (match) {
                console.log('Match found! Updating link...');
                // Manually insert link for now to be safe and quick
                await client.query(`
                     INSERT INTO ai_prediction_matches (
                         prediction_id, match_external_id, overall_confidence, prediction_result, created_at, updated_at
                     ) VALUES ($1, $2, $3, $4, NOW(), NOW())
                     ON CONFLICT (prediction_id) DO UPDATE SET 
                         match_external_id = EXCLUDED.match_external_id,
                         updated_at = NOW()
                 `, [predId, match.external_id, 0.85, 'pending']);
                console.log('Link updated via SQL.');
            } else {
                console.log('Matcher logic FAILED to fuzzy match names.');
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
