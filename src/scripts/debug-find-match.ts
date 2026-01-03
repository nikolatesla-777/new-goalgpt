
import { pool } from '../database/connection';

async function main() {
    const term = process.argv[2] || 'Juventus';
    const term2 = process.argv[3] || 'Lecce';

    const client = await pool.connect();
    try {
        console.log(`Searching for match: ${term} vs ${term2}`);
        // Search in home_team or away_team columns (assuming they exist or using match_title logic or jsonb)
        // Check schema -> previously I saw `home_team_id`. Names might be in `teams` table or `ts_matches` might have display names?
        // Let's try to join or just search broadly.
        // Or AI predictions table has `home_team_name`.

        const res = await client.query(`
            SELECT p.id as pred_id, p.match_external_id, p.home_team_name, p.away_team_name, p.score_at_prediction, p.minute_at_prediction, p.created_at, pm.prediction_result
            FROM ai_predictions p
            LEFT JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
            WHERE p.home_team_name ILIKE $1 AND p.away_team_name ILIKE $2
            ORDER BY p.created_at DESC
            LIMIT 5
        `, [`%${term}%`, `%${term2}%`]);

        if (res.rows.length === 0) {
            console.log('No prediction found by team names.');
        } else {
            console.log('Found predictions:');
            console.log(JSON.stringify(res.rows, null, 2));

            // If we have match_external_id, fetch match stats
            if (res.rows[0].match_external_id) {
                const mid = res.rows[0].match_external_id;
                console.log(`\nChecking Match Stats for ID: ${mid}`);
                const mRes = await client.query(`SELECT * FROM ts_matches WHERE external_id = $1`, [mid]);
                if (mRes.rows.length > 0) {
                    const m = mRes.rows[0];
                    console.log(`Status: ${m.status_id}, Score: ${m.home_score_display}-${m.away_score_display}, Minute: ${m.minute}`);
                    console.log(`Incidents:`, m.incidents);
                } else {
                    console.log('Match not found in ts_matches (by external_id).');
                }
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
