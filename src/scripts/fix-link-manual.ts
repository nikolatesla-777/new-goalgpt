
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        const predId = 'ab7f0bba-7307-49cf-a30d-d818fc5463ff';
        const matchExternalId = 'k82rekhg12wnrep'; // From verification step

        console.log(`Linking prediction ${predId} to match ${matchExternalId} ...`);

        const res = await client.query(`
             INSERT INTO ai_prediction_matches (
                 prediction_id, match_external_id, overall_confidence, prediction_result, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT (prediction_id) DO UPDATE SET 
                 match_external_id = EXCLUDED.match_external_id,
                 updated_at = NOW()
             RETURNING *;
        `, [predId, matchExternalId, 0.85, 'pending']);

        console.log('Link success:', res.rows[0]);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
