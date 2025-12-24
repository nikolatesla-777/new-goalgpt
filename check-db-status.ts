import { pool } from './src/database/connection';

async function checkStatus() {
  const client = await pool.connect();
  try {
    // Counts
    const matches = await client.query('SELECT COUNT(*) as count FROM ts_matches');
    const teams = await client.query('SELECT COUNT(*) as count FROM ts_teams');
    const comps = await client.query('SELECT COUNT(*) as count FROM ts_competitions');
    const sync = await client.query('SELECT COUNT(*) as count FROM ts_sync_state');
    
    console.log('\n📊 DATABASE STATUS:');
    console.log(`Matches: ${matches.rows[0].count}`);
    console.log(`Teams: ${teams.rows[0].count}`);
    console.log(`Competitions: ${comps.rows[0].count}`);
    console.log(`Sync State Records: ${sync.rows[0].count}`);
    
    // Sample data
    if (parseInt(matches.rows[0].count) > 0) {
      const sampleMatches = await client.query(
        'SELECT external_id, home_team_id, away_team_id, competition_id, status_id, match_time FROM ts_matches LIMIT 3'
      );
      console.log('\n📋 Sample Matches:');
      sampleMatches.rows.forEach((row, i) => {
        console.log(`  ${i+1}. Match ${row.external_id}: Teams(${row.home_team_id}, ${row.away_team_id}), Comp(${row.competition_id}), Status(${row.status_id})`);
      });
    }
    
    if (parseInt(teams.rows[0].count) > 0) {
      const sampleTeams = await client.query('SELECT external_id, name FROM ts_teams LIMIT 5');
      console.log('\n⚽ Sample Teams:');
      sampleTeams.rows.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.name} (ID: ${row.external_id})`);
      });
    }
    
    if (parseInt(comps.rows[0].count) > 0) {
      const sampleComps = await client.query('SELECT external_id, name FROM ts_competitions LIMIT 5');
      console.log('\n🏆 Sample Competitions:');
      sampleComps.rows.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.name} (ID: ${row.external_id})`);
      });
    }
    
    // Sync state
    if (parseInt(sync.rows[0].count) > 0) {
      const syncStates = await client.query('SELECT entity_type, last_updated_at, last_sync_at FROM ts_sync_state');
      console.log('\n🔄 Sync States:');
      syncStates.rows.forEach((row) => {
        console.log(`  ${row.entity_type}: last_updated_at=${row.last_updated_at}, last_sync=${row.last_sync_at}`);
      });
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkStatus().catch(console.error);






