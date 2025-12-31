const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Manual env loading
const envPath = path.resolve(__dirname, '.env');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function analyze() {
    const client = await pool.connect();
    try {
        console.log('=== DATABASE ANALYSIS ===\n');

        // 1. Get all ts_ tables
        const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename LIKE 'ts_%' 
      ORDER BY tablename
    `);
        console.log('TheSports Tables:', tables.rows.map(r => r.tablename));

        // 2. Count rows in each
        console.log('\n--- Row Counts ---');
        for (const t of tables.rows) {
            const count = await client.query(`SELECT COUNT(*) FROM ${t.tablename}`);
            console.log(`${t.tablename}: ${count.rows[0].count} rows`);
        }

        // 3. Analyze ts_teams
        console.log('\n--- ts_teams Analysis ---');
        const teamCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_teams'`);
        console.log('Columns:', teamCols.rows.map(r => r.column_name));

        const teamsWithoutComp = await client.query(`SELECT COUNT(*) FROM ts_teams WHERE competition_id IS NULL`);
        console.log('Teams without competition_id:', teamsWithoutComp.rows[0].count);

        // 4. Analyze ts_players
        console.log('\n--- ts_players Analysis ---');
        const playerCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_players'`);
        console.log('Columns:', playerCols.rows.map(r => r.column_name));

        const playersWithoutTeam = await client.query(`SELECT COUNT(*) FROM ts_players WHERE team_id IS NULL`);
        console.log('Players without team_id:', playersWithoutTeam.rows[0].count);

        // 5. Analyze ts_matches
        console.log('\n--- ts_matches Analysis ---');
        const matchCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_matches'`);
        console.log('Columns:', matchCols.rows.map(r => r.column_name));

        const matchesByComp = await client.query(`
      SELECT competition_id, COUNT(*) 
      FROM ts_matches 
      GROUP BY competition_id 
      ORDER BY count DESC 
      LIMIT 10
    `);
        console.log('Matches by Competition (top 10):', matchesByComp.rows);

        // 6. Analyze ts_standings
        console.log('\n--- ts_standings Analysis ---');
        const standingCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'ts_standings'`);
        console.log('Columns:', standingCols.rows.map(r => r.column_name));

        const emptyStandings = await client.query(`SELECT COUNT(*) FROM ts_standings WHERE standings = '{}'`);
        const nonEmptyStandings = await client.query(`SELECT COUNT(*) FROM ts_standings WHERE standings != '{}'`);
        console.log('Empty standings:', emptyStandings.rows[0].count);
        console.log('Non-empty standings:', nonEmptyStandings.rows[0].count);

        // 7. Check team_id types
        console.log('\n--- ID Type Analysis ---');
        const sampleTeam = await client.query(`SELECT id, external_id FROM ts_teams LIMIT 1`);
        console.log('Sample Team ID (UUID):', sampleTeam.rows[0]?.id);
        console.log('Sample Team External ID (String):', sampleTeam.rows[0]?.external_id);

        const samplePlayer = await client.query(`SELECT team_id FROM ts_players WHERE team_id IS NOT NULL LIMIT 1`);
        console.log('Sample Player team_id:', samplePlayer.rows[0]?.team_id);

        const sampleMatch = await client.query(`SELECT home_team_id, away_team_id FROM ts_matches LIMIT 1`);
        console.log('Sample Match home_team_id:', sampleMatch.rows[0]?.home_team_id);

        // 8. Check if player team_id matches team external_id
        console.log('\n--- Relationship Verification ---');
        const playerTeamJoin = await client.query(`
      SELECT COUNT(*) 
      FROM ts_players p 
      JOIN ts_teams t ON p.team_id = t.external_id
    `);
        console.log('Players with valid team link (via external_id):', playerTeamJoin.rows[0].count);

        const totalPlayers = await client.query(`SELECT COUNT(*) FROM ts_players WHERE team_id IS NOT NULL`);
        console.log('Total players with team_id:', totalPlayers.rows[0].count);

    } finally {
        client.release();
        pool.end();
    }
}

analyze().catch(console.error);
