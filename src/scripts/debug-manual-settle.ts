
import { pool } from '../database/connection';

async function checkInstantWin(predictionType: string, predictionValue: string, newTotalGoals: number, minute: number) {
    const value = parseFloat(predictionValue);
    const isOver = predictionType.toUpperCase().includes('ÜST');
    const isIY = predictionType.toUpperCase().includes('IY');

    console.log(`Checking: Type=${predictionType}, Val=${value}, Goals=${newTotalGoals}, Min=${minute}`);

    // Adjusted logic: allow IY up to 55 for injury time
    if (isIY && minute > 55) {
        console.log('Reason: IY period ended (> 55)');
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

    return { isInstantWin: false, reason: null };
}

async function main() {
    const matchId = process.argv[2];
    const homeScore = parseInt(process.argv[3] || '0', 10);
    const awayScore = parseInt(process.argv[4] || '0', 10);
    const minute = parseInt(process.argv[5] || '46', 10);

    if (!matchId) {
        console.error('Usage: <matchId> <homeScore> <awayScore> <minute>');
        process.exit(1);
    }

    const client = await pool.connect();
    try {
        // Query pending predictions
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
              AND pm.prediction_result = 'pending'
        `;

        const result = await client.query(query, [matchId]);
        console.log(`Found ${result.rows.length} pending predictions for match ${matchId}`);

        for (const row of result.rows) {
            console.log(`--- Checking Prediction ${row.prediction_id} ---`);
            const totalGoals = homeScore + awayScore;

            const check = await checkInstantWin(row.prediction_type, row.prediction_value, totalGoals, minute);

            if (check.isInstantWin) {
                console.log('WOULD SETTLE AS WINNER! Executing update...');
                // Apply fix
                await client.query(`
                    UPDATE ai_prediction_matches 
                    SET prediction_result = 'winner', 
                        result_reason = $1,
                        final_home_score = $2,
                        final_away_score = $3,
                        resulted_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $4
                `, [check.reason, homeScore, awayScore, row.match_link_id]);
                console.log('✅ Updated database.');
            } else {
                console.log('WOULD NOT SETTLE. Reason:', check.reason);
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
