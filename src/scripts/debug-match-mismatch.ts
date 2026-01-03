
import { pool } from '../database/connection';

async function main() {
    const term1 = process.argv[2] || 'Ittihad';
    const term2 = process.argv[3] || 'Taawon';

    const client = await pool.connect();
    try {
        console.log(`1. Searching for Prediction with terms: ${term1}, ${term2}`);
        const predQuery = `
            SELECT p.id, p.home_team_name, p.away_team_name, p.created_at, pm.match_external_id, pm.prediction_result
            FROM ai_predictions p
            LEFT JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
            WHERE p.home_team_name ILIKE $1 AND p.away_team_name ILIKE $2
            ORDER BY p.created_at DESC
            LIMIT 5
        `;
        const preds = await client.query(predQuery, [`%${term1}%`, `%${term2}%`]);
        console.log(`Found ${preds.rows.length} predictions:`);
        preds.rows.forEach(r => console.log(JSON.stringify(r)));

        console.log(`\n2. Searching for potential matches in ts_matches with terms: ${term1}, ${term2}`);
        // Search home OR away broadly
        const matchQuery = `
            SELECT id, external_id, home_team_name, away_team_name, match_time, status_id, home_score_display, away_score_display
            FROM ts_matches
            WHERE (home_team_name ILIKE $1 OR away_team_name ILIKE $1)
               AND (home_team_name ILIKE $2 OR away_team_name ILIKE $2)
            ORDER BY match_time DESC
            LIMIT 5
        `;
        const matches = await client.query(matchQuery, [`%${term1}%`, `%${term2}%`]);
        console.log(`Found ${matches.rows.length} potential matches:`);
        matches.rows.forEach(r => console.log(JSON.stringify(r)));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
