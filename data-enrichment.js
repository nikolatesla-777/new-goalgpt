/**
 * Data Enrichment Script
 * 
 * Fixes missing IDs:
 * 1. Teams without competition_id - derived from their matches
 * 2. Players without team_id - needs API call or match lineup data
 * 
 * Run on VPS: node data-enrichment.js
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Manual env loading
const envPath = path.resolve(__dirname, '.env');
try {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const [k, ...v] = line.split('=');
        if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
    });
} catch (e) { }

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
});

async function enrichTeamCompetitionIds() {
    console.log('\n=== ENRICHING TEAM COMPETITION IDs ===\n');
    const client = await pool.connect();

    try {
        // Strategy: For each team without competition_id, 
        // find the competition they play most matches in

        const result = await client.query(`
      WITH team_matches AS (
        SELECT 
          t.external_id as team_id,
          m.competition_id,
          COUNT(*) as match_count
        FROM ts_teams t
        JOIN ts_matches m ON (m.home_team_id = t.external_id OR m.away_team_id = t.external_id)
        WHERE t.competition_id IS NULL
        GROUP BY t.external_id, m.competition_id
      ),
      ranked AS (
        SELECT 
          team_id,
          competition_id,
          match_count,
          ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY match_count DESC) as rn
        FROM team_matches
      )
      SELECT team_id, competition_id, match_count
      FROM ranked
      WHERE rn = 1
    `);

        console.log(`Found ${result.rows.length} teams with matches but no competition_id`);

        let updated = 0;
        for (const row of result.rows) {
            await client.query(
                `UPDATE ts_teams SET competition_id = $1, updated_at = NOW() WHERE external_id = $2`,
                [row.competition_id, row.team_id]
            );
            updated++;

            if (updated % 1000 === 0) {
                console.log(`Updated ${updated} teams...`);
            }
        }

        console.log(`✅ Updated ${updated} teams with competition_id`);

        // Check remaining
        const remaining = await client.query(`SELECT COUNT(*) FROM ts_teams WHERE competition_id IS NULL`);
        console.log(`Remaining teams without competition_id: ${remaining.rows[0].count}`);

    } finally {
        client.release();
    }
}

async function enrichPlayerTeamIds() {
    console.log('\n=== ENRICHING PLAYER TEAM IDs ===\n');
    const client = await pool.connect();

    try {
        // Strategy 1: Use primary_team_id if available
        const primaryTeamResult = await client.query(`
      UPDATE ts_players 
      SET team_id = primary_team_id, updated_at = NOW()
      WHERE team_id IS NULL AND primary_team_id IS NOT NULL
    `);
        console.log(`Updated ${primaryTeamResult.rowCount} players with primary_team_id`);

        // Check remaining
        const remaining = await client.query(`SELECT COUNT(*) FROM ts_players WHERE team_id IS NULL`);
        console.log(`Remaining players without team_id: ${remaining.rows[0].count}`);

        // Strategy 2: For remaining, we'd need to call API or use match lineups
        // This is expensive, so we'll skip for now
        console.log('Note: Remaining players may need API calls to fetch team info');

    } finally {
        client.release();
    }
}

async function verifyRelationships() {
    console.log('\n=== VERIFYING RELATIONSHIPS ===\n');
    const client = await pool.connect();

    try {
        // Players with valid team link
        const playerTeamJoin = await client.query(`
      SELECT COUNT(*) 
      FROM ts_players p 
      JOIN ts_teams t ON p.team_id = t.external_id
    `);
        console.log('Players with valid team link:', playerTeamJoin.rows[0].count);

        // Teams with valid competition link
        const teamCompJoin = await client.query(`
      SELECT COUNT(*) 
      FROM ts_teams t 
      JOIN ts_competitions c ON t.competition_id = c.external_id
    `);
        console.log('Teams with valid competition link:', teamCompJoin.rows[0].count);

        // Matches with valid team links
        const matchTeamJoin = await client.query(`
      SELECT COUNT(*) 
      FROM ts_matches m 
      JOIN ts_teams ht ON m.home_team_id = ht.external_id
      JOIN ts_teams at ON m.away_team_id = at.external_id
    `);
        console.log('Matches with valid team links:', matchTeamJoin.rows[0].count);

        // Standings with data
        const standingsCheck = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE standings IS NOT NULL AND standings != '{}') as with_data,
        COUNT(*) as total
      FROM ts_standings
    `);
        console.log(`Standings: ${standingsCheck.rows[0].with_data} with data / ${standingsCheck.rows[0].total} total`);

    } finally {
        client.release();
    }
}

async function main() {
    console.log('🔧 Starting Data Enrichment...\n');

    try {
        await enrichTeamCompetitionIds();
        await enrichPlayerTeamIds();
        await verifyRelationships();

        console.log('\n✅ Data Enrichment Complete!\n');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        pool.end();
    }
}

main();
