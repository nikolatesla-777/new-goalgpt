
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        console.log('Searching for "Benfica" match...');
        const matchQuery = `
            SELECT m.id, m.external_id, m.match_time, m.status_id, m.minute, m.home_scores, m.away_scores,
                   t1.name as home, t2.name as away
            FROM ts_matches m
            LEFT JOIN ts_teams t1 ON m.home_team_id = t1.external_id
            LEFT JOIN ts_teams t2 ON m.away_team_id = t2.external_id
            WHERE t1.name ILIKE '%Benfica%' OR t2.name ILIKE '%Benfica%'
            ORDER BY m.match_time DESC
            LIMIT 5
        `;
        const matches = await client.query(matchQuery);
        console.log(`Found ${matches.rows.length} matches:`);
        matches.rows.forEach(r => console.log(JSON.stringify(r)));

        if (matches.rows.length > 0) {
            const matchId = matches.rows[0].external_id;
            console.log(`\nChecking Predictions for match ${matchId}...`);
            const predQuery = `
                SELECT p.id, p.prediction_type, p.prediction_value, pm.prediction_result, pm.match_external_id
                FROM ai_predictions p
                JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
                WHERE pm.match_external_id = $1
            `;
            const preds = await client.query(predQuery, [matchId]);
            console.log(`Found ${preds.rows.length} predictions:`);
            preds.rows.forEach(r => console.log(JSON.stringify(r)));
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
