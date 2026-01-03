
import { pool } from '../database/connection';

async function checkInstantWin(predictionType: string, predictionValue: string, newTotalGoals: number, minute: number) {
    const value = parseFloat(predictionValue);
    const isOver = predictionType.toUpperCase().includes('ÜST');
    const isUnder = predictionType.toUpperCase().includes('ALT');
    const isIY = predictionType.toUpperCase().includes('IY');
    const isMS = predictionType.toUpperCase().includes('MS');

    console.log(`Checking: Type=${predictionType}, Val=${value}, Goals=${newTotalGoals}, Min=${minute}`);
    console.log(`Parsed: isOver=${isOver}, isUnder=${isUnder}, isIY=${isIY}, isMS=${isMS}`);

    if (isIY && minute > 45) {
        console.log('Reason: IY period ended');
        return { isInstantWin: false, reason: 'IY period ended' };
    }

    if (isOver) {
        if (newTotalGoals > value) {
            console.log('Result: WINNER');
            return { isInstantWin: true, reason: `Skor (${newTotalGoals}) > ${value} - KAZANDI` };
        } else {
            console.log('Result: Continuing (Goals <= Value)');
        }
    }

    // ... (rest of logic not needed for this Over case)
    return { isInstantWin: false, reason: null };
}

async function main() {
    const matchId = process.argv[2] || 'dn1m1ghl3wopmoe';
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                p.id as prediction_id, 
                p.prediction_type, 
                p.prediction_value,
                pm.id as match_link_id,
                pm.prediction_result
            FROM ai_predictions p
            JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
            WHERE pm.match_external_id = $1
        `;

        const result = await client.query(query, [matchId]);
        console.log(`Found ${result.rows.length} predictions for match ${matchId}`);

        for (const row of result.rows) {
            console.log(`--- Checking Prediction ${row.prediction_id} ---`);
            const check = await checkInstantWin(row.prediction_type, row.prediction_value, 1, 23); // Force inputs: 1 goal, 23 min

            if (check.isInstantWin) {
                console.log('WOULD SETTLE AS WINNER!');
                // Uncomment to apply fix if needed
                // await client.query(`UPDATE ai_prediction_matches SET prediction_result = 'winner', result_reason = $1 WHERE id = $2`, [check.reason, row.match_link_id]);
            } else {
                console.log('WOULD NOT SETTLE.');
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
