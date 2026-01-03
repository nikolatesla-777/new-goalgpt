
import { pool } from '../connection';

async function main() {
    const matchId = process.argv[2];
    if (!matchId) {
        console.error('Usage: debug-prediction <matchId>');
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        console.log(`Analyzing match: ${matchId}`);

        // 1. Get Match Info
        const matchRes = await client.query(`SELECT id, home_team, away_team, home_score, away_score, status_id, status FROM ts_matches WHERE id = $1`, [matchId]);
        console.log('--- Match Info ---');
        if (matchRes.rows.length === 0) {
            console.log('Match custom ID not found in ts_matches. Trying external ID lookup...');
            // Try looking up by external_id if possible? Or maybe the ID passed IS the external ID.
            // ai_prediction_matches stores match_external_id. 
        } else {
            console.log(JSON.stringify(matchRes.rows[0], null, 2));
        }

        // 2. Get Predictions
        const predRes = await client.query(`
            SELECT 
                pm.id as pm_id, pm.prediction_result, pm.result_reason, 
                p.id as p_id, p.prediction_type, p.prediction_value, p.minute_at_prediction, p.score_at_prediction,
                p.bot_name, p.created_at, p.display_prediction,
                pm.created_at as match_link_created_at
            FROM ai_prediction_matches pm 
            JOIN ai_predictions p ON pm.prediction_id = p.id 
            WHERE pm.match_external_id = $1
        `, [matchId]);

        console.log('--- Predictions ---');
        if (predRes.rows.length === 0) {
            console.log('No predictions found for this match ID.');
        } else {
            predRes.rows.forEach(row => {
                console.log(JSON.stringify(row, null, 2));
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
