import { pool } from '../database/connection';

async function check() {
    const teams = [
        { id: '56ypq3nhdpymd7o', name: 'Fenerbahce' },
        { id: 'z318q66hlxwqo9j', name: 'Samsunspor' },
        { id: 'kjw2r09hy0grz84', name: 'Antalyaspor' },
        { id: 'z318q66hp66qo9j', name: 'Galatasaray' }
    ];

    const dbClient = await pool.connect();
    try {
        for (const team of teams) {
            const res = await dbClient.query('SELECT count(*) FROM ts_players WHERE team_id = $1', [team.id]);
            console.log(`${team.name} (${team.id}) player count: ${res.rows[0].count}`);
        }
    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        dbClient.release();
        process.exit(0);
    }
}

check();
