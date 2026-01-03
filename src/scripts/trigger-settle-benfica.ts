
import { pool } from '../database/connection';
import { aiPredictionService } from '../services/ai/aiPrediction.service';

async function main() {
    const client = await pool.connect();
    try {
        const matchId = 'n54qllhn85loqvy';
        console.log(`Updating scores for match ${matchId} to ensure HT score is present...`);

        // Simulating [current, ht] array format
        // Current: 2-1, HT: 2-1
        await client.query(`
            UPDATE ts_matches
            SET home_scores = '[2, 2]', away_scores = '[1, 1]', updated_at = NOW()
            WHERE external_id = $1
        `, [matchId]);

        console.log('Scores updated. Triggering settleInstantWin...');

        await aiPredictionService.settleInstantWin(matchId, 2, 1, 46);

        console.log('Settlement triggered. Checking result...');

        const res = await client.query(`
            SELECT p.id, p.prediction_type, pm.prediction_result, pm.result_reason
            FROM ai_prediction_matches pm
            JOIN ai_predictions p ON p.id = pm.prediction_id
            WHERE pm.match_external_id = $1
        `, [matchId]);

        res.rows.forEach(r => console.log(JSON.stringify(r)));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
