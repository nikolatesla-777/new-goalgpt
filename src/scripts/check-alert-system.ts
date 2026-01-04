
import { pool } from '../database/connection';

async function checkAlertSystem() {
    try {
        console.log('=== Checking Alert System Predictions ===\n');

        // Get latest Alert System predictions
        const q1 = await pool.query(`
            SELECT id, external_id, bot_name, league_name, home_team_name, away_team_name, 
                   prediction_type, prediction_value, created_at 
            FROM ai_predictions 
            WHERE bot_name = 'Alert System' 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        console.log('ai_predictions (Alert System):');
        for (const row of q1.rows) {
            console.log(`  ID: ${row.id}`);
            console.log(`  External ID: ${row.external_id}`);
            console.log(`  Teams: ${row.home_team_name} vs ${row.away_team_name}`);
            console.log(`  League: ${row.league_name}`);
            console.log(`  Prediction: ${row.prediction_type} / ${row.prediction_value}`);
            console.log(`  Created: ${row.created_at}`);
            console.log('  ---');
        }

        // Get corresponding ai_prediction_matches
        if (q1.rows.length > 0) {
            const ids = q1.rows.map((r: any) => r.id);
            const q2 = await pool.query(
                `SELECT * FROM ai_prediction_matches WHERE prediction_id = ANY($1)`,
                [ids]
            );

            console.log('\nai_prediction_matches:');
            for (const row of q2.rows) {
                console.log(`  Prediction ID: ${row.prediction_id}`);
                console.log(`  Match External ID: ${row.match_external_id}`);
                console.log(`  Match Status: ${row.match_status}`);
                console.log(`  Confidence: ${row.overall_confidence}`);
                console.log(`  Result: ${row.prediction_result}`);
                console.log('  ---');
            }
        }

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

checkAlertSystem();
