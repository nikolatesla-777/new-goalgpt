
import { pool } from '../database/connection';

async function main() {
    const term1 = process.argv[2] || 'Ittihad';
    const term2 = process.argv[3] || 'Taawon';

    const client = await pool.connect();
    try {
        console.log(`1. Predictions with terms: ${term1}, ${term2}`);
        const predQuery = `
            SELECT p.id, p.home_team_name, p.away_team_name, p.created_at, pm.match_external_id, pm.prediction_result
            FROM ai_predictions p
            LEFT JOIN ai_prediction_matches pm ON pm.prediction_id = p.id
            WHERE p.home_team_name ILIKE $1 AND p.away_team_name ILIKE $2
            ORDER BY p.created_at DESC
            LIMIT 5
        `;
        const preds = await client.query(predQuery, [`%${term1}%`, `%${term2}%`]);
        console.log(`Found ${preds.rows.length} predictions:`);
        preds.rows.forEach(r => console.log(JSON.stringify(r)));

        console.log(`\n2. Potential Teams in ts_teams:`);
        const teamQuery = `
            SELECT id, name FROM ts_teams WHERE name ILIKE $1 OR name ILIKE $2 LIMIT 10
        `;
        const teams = await client.query(teamQuery, [`%${term1}%`, `%${term2}%`]);
        console.log(`Found ${teams.rows.length} teams:`);
        teams.rows.forEach(r => console.log(JSON.stringify(r)));

        if (teams.rows.length > 0) {
            console.log(`\n3. Potential Matches in ts_matches using found Team IDs:`);
            const teamIds = teams.rows.map(t => t.id);
            const matchQuery = `
                SELECT m.id, m.external_id, m.match_time, m.status_id, 
                       t1.name as home_name, t2.name as away_name
                FROM ts_matches m
                LEFT JOIN ts_teams t1 ON m.home_team_id = t1.id
                LEFT JOIN ts_teams t2 ON m.away_team_id = t2.id
                WHERE m.home_team_id = ANY($1) OR m.away_team_id = ANY($1)
                ORDER BY m.match_time DESC
                LIMIT 5
            `;
            const matches = await client.query(matchQuery, [teamIds]);
            console.log(`Found ${matches.rows.length} matches linked to these teams:`);
            matches.rows.forEach(r => console.log(JSON.stringify(r)));
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
