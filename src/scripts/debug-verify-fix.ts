
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        console.log('Searching for "Ittihad" matches in valid DB...');
        const matchQuery = `
            SELECT m.id, m.external_id, m.match_time, m.competition_id, t1.name as home, t2.name as away
            FROM ts_matches m
            LEFT JOIN ts_teams t1 ON m.home_team_id = t1.external_id
            LEFT JOIN ts_teams t2 ON m.away_team_id = t2.external_id
            WHERE t1.name ILIKE '%Ittihad%' OR t2.name ILIKE '%Ittihad%'
            ORDER BY m.match_time DESC
            LIMIT 5
        `;
        const matches = await client.query(matchQuery);
        console.log(`Found ${matches.rows.length} matches:`);
        matches.rows.forEach(r => console.log(JSON.stringify(r)));

        console.log('\nChecking Prediction Linkage...');
        // We know the prediction ID from earlier (ab7f0bba-7307-49cf-a30d-d818fc5463ff)
        // Or just search by names
        const predQuery = `
            SELECT p.id, p.home_team_name, pm.match_external_id, pm.id as link_id
            FROM ai_predictions p
            LEFT JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
            WHERE p.home_team_name ILIKE '%Ittihad%' AND p.away_team_name ILIKE '%Taawon%'
        `;
        const preds = await client.query(predQuery);
        console.log(`Found ${preds.rows.length} predictions:`);
        preds.rows.forEach(r => console.log(JSON.stringify(r)));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
