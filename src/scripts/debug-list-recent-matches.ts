
import { pool } from '../database/connection';

async function main() {
    const hours = parseInt(process.argv[2] || '4', 10);
    const client = await pool.connect();
    try {
        console.log(`Listing matches from last ${hours} hours...`);
        const query = `
            SELECT 
                m.id, 
                m.external_id, 
                m.match_time, 
                to_timestamp(m.match_time) as match_date,
                m.status_id,
                m.home_team_id,
                m.away_team_id,
                t1.name as home_name,
                t2.name as away_name
            FROM ts_matches m
            LEFT JOIN ts_teams t1 ON m.home_team_id = t1.external_id
            LEFT JOIN ts_teams t2 ON m.away_team_id = t2.external_id
            WHERE to_timestamp(m.match_time) > NOW() - interval '${hours} hours'
              AND to_timestamp(m.match_time) < NOW() + interval '2 hours'
            ORDER BY m.match_time DESC
            LIMIT 50
        `;

        const res = await client.query(query);
        console.log(`Found ${res.rows.length} matches:`);
        for (const row of res.rows) {
            console.log(`[${row.match_date.toISOString()}] ${row.home_name || row.home_team_id} vs ${row.away_name || row.away_team_id} (Status: ${row.status_id})`);
            if (row.home_name && row.home_name.includes('Ittihad')) {
                console.log('!!! FOUND ITTIHAD MATCH: ', row);
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
