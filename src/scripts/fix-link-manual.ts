
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        const predId = 'ab7f0bba-7307-49cf-a30d-d818fc5463ff';
        const matchExternalId = 'k82rekhg12wnrep'; // From verification step

        console.log(`Linking prediction ${predId} to match ${matchExternalId} ...`);

        // Check if exists
        const check = await client.query('SELECT id FROM ai_prediction_matches WHERE prediction_id = $1', [predId]);
        if (check.rows.length > 0) {
            console.log('Record exists, updating...');
            await client.query(`
                 UPDATE ai_prediction_matches 
                 SET match_external_id = $1, updated_at = NOW() 
                 WHERE prediction_id = $2
             `, [matchExternalId, predId]);
        } else {
            console.log('Record does not exist, inserting...');
            await client.query(`
                 INSERT INTO ai_prediction_matches (
                     prediction_id, match_external_id, overall_confidence, prediction_result, created_at, updated_at
                 ) VALUES ($1, $2, $3, $4, NOW(), NOW())
             `, [predId, matchExternalId, 0.85, 'pending']);
        }

        console.log('Link success.');

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
