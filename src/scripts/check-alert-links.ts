import { pool } from '../database/connection';

async function checkAlertSystemLinks() {
    try {
        // Get ALL Alert System predictions from ai_predictions
        const preds = await pool.query(`
            SELECT p.id, p.home_team_name, p.away_team_name, p.prediction_type, p.created_at
            FROM ai_predictions p
            WHERE p.bot_name = 'Alert System'
            ORDER BY p.created_at DESC
            LIMIT 15
        `);

        console.log('=== ALL ALERT SYSTEM PREDICTIONS ===');
        for (const r of preds.rows) {
            // Check if linked in ai_prediction_matches
            const pm = await pool.query('SELECT match_external_id FROM ai_prediction_matches WHERE prediction_id = $1', [r.id]);
            const linked = pm.rows.length > 0 ? pm.rows[0].match_external_id : 'NOT LINKED!';
            console.log(`${r.home_team_name} vs ${r.away_team_name} | ${r.prediction_type} | Link: ${linked}`);
        }

        process.exit(0);
    } catch (e: any) {
        console.error('Error:', e.message);
        process.exit(1);
    }
}

checkAlertSystemLinks();
