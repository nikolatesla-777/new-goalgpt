
import { pool } from './src/database/connection';

async function findMatch() {
    console.log('Starting search for Belouizdad match...');
    try {
        const competitionId = 'kdj2ryohk2dq1zp';
        const result = await pool.query(
            'SELECT external_id, home_score_regular, away_score_regular, status_id, minute, match_time FROM ts_matches WHERE competition_id = $1 AND match_time >= EXTRACT(EPOCH FROM NOW())::bigint - 86400',
            [competitionId]
        );
        console.log('Found ' + result.rows.length + ' matches');
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit(0);
    }
}

findMatch();
