
import { Pool } from 'pg';

const pool = new Pool({
    connectionString: 'postgres://default:Advant2024@142.93.103.128:5432/goalgpt',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const res = await pool.query(`
      SELECT id, created_at, prediction_type, prediction_value, home_team_name, away_team_name, status_id, prediction_result
      FROM ai_predictions p
      LEFT JOIN ai_prediction_matches pm ON p.id = pm.prediction_id
      LEFT JOIN ts_matches m ON pm.match_uuid = m.uuid
      WHERE p.home_team_name ILIKE '%Sama Al Sarhan%'
      LIMIT 1
    `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
