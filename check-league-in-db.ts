// Check if ts_matches has league/competition info
import { pool } from './src/database/connection';

async function checkLeague() {
  const client = await pool.connect();
  try {
    // Get a recent match to see structure
    const result = await client.query(`
      SELECT 
        external_id,
        home_name,
        away_name,
        competition_id,
        competition_name,
        league_id,
        league_name
      FROM ts_matches
      WHERE external_id IS NOT NULL
      LIMIT 5
    `);
    
    console.log('=== TS_MATCHES LEAGUE FIELDS ===\n');
    console.log('Columns:', Object.keys(result.rows[0] || {}));
    console.log('\nSample rows:');
    result.rows.forEach(row => {
      console.log(`\nMatch: ${row.home_name} vs ${row.away_name}`);
      console.log(`  competition_id: ${row.competition_id}`);
      console.log(`  competition_name: ${row.competition_name}`);
      console.log(`  league_id: ${row.league_id}`);
      console.log(`  league_name: ${row.league_name}`);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

checkLeague();
