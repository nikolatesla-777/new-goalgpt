
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    connectionString: 'postgres://postgres.wakbsxzocfpngywyzdml:fH1MyVUk0h7a0t14@aws-1-eu-central-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function fixData() {
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();

        // QUERY JOINED DATA TO FIND ID
        console.log('Searching for Sama Al Sarhan prediction...');
        const findQuery = `
            SELECT p.id as prediction_id, pm.id as match_link_id
            FROM ai_predictions p
            LEFT JOIN ai_prediction_matches pm ON p.id = pm.prediction_id
            WHERE p.home_team_name ILIKE '%Sama Al Sarhan%' 
               OR p.away_team_name ILIKE '%Sama Al Sarhan%'
        `;
        const res = await client.query(findQuery);

        if (res.rows.length === 0) {
            console.log('No prediction found!');
        } else {
            console.log('Found predictions:', res.rows);

            for (const row of res.rows) {
                console.log(`Updating prediction ${row.prediction_id}...`);

                // 1. Update Text in ai_predictions
                await client.query(`
                    UPDATE ai_predictions 
                    SET prediction_value = 'MS 5.5 ÜST',
                        prediction_type = 'MS'
                    WHERE id = $1
                `, [row.prediction_id]);

                // 2. Update Result in ai_prediction_matches
                if (row.match_link_id) {
                    await client.query(`
                        UPDATE ai_prediction_matches
                        SET prediction_result = 'loser',
                            resulted_at = NOW()
                        WHERE id = $1
                    `, [row.match_link_id]);
                    console.log(`Prediction MATCH ${row.match_link_id} updated to loser.`);
                } else {
                    console.log('Warning: No match link found for this prediction!');
                }

                console.log(`Prediction ${row.prediction_id} text updated.`);
            }
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

fixData();
