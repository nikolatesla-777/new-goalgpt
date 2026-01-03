
import { pool } from '../database/connection';

async function main() {
    const client = await pool.connect();
    try {
        console.log('Checking Teams for Competition External ID "27"...');
        const teamQuery = `
            SELECT id, name, external_id 
            FROM ts_teams 
            WHERE competition_id = '27'
            LIMIT 10
        `;
        const teams = await client.query(teamQuery);
        console.log(`Found ${teams.rows.length} teams for Comp 27:`);
        teams.rows.forEach(r => console.log(JSON.stringify(r)));

        console.log('\nChecking Matches for Competition External ID "27" (Last 7 days)...');
        const matchQuery = `
            SELECT m.id, m.external_id, m.match_time, m.home_team_id, m.away_team_id, m.status_id
            FROM ts_matches m
            WHERE m.competition_id = '27'
              AND to_timestamp(m.match_time) > NOW() - interval '7 days'
            ORDER BY m.match_time DESC
            LIMIT 10
        `;
        const matches = await client.query(matchQuery);
        console.log(`Found ${matches.rows.length} matches for Comp 27:`);
        matches.rows.forEach(r => console.log(JSON.stringify(r)));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

main();
