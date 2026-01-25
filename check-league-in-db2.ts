// Check ts_matches table structure
import { pool } from './src/database/connection';

async function checkLeague() {
  const client = await pool.connect();
  try {
    // Get column names
    const colResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ts_matches'
      ORDER BY ordinal_position
    `);
    
    console.log('=== TS_MATCHES COLUMNS ===');
    const columns = colResult.rows.map(r => r.column_name);
    console.log(columns.join(', '));
    
    // Find league-related columns
    const leagueColumns = columns.filter(c => 
      c.includes('league') || 
      c.includes('competition') || 
      c.includes('tournament')
    );
    
    console.log('\n=== LEAGUE-RELATED COLUMNS ===');
    console.log(leagueColumns);
    
    // Get sample data
    if (leagueColumns.length > 0) {
      const selectCols = ['id', ...leagueColumns].join(', ');
      const result = await client.query(`
        SELECT ${selectCols}
        FROM ts_matches
        WHERE id IS NOT NULL
        LIMIT 3
      `);
      
      console.log('\n=== SAMPLE DATA ===');
      result.rows.forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });
    }
  } finally {
    client.release();
    await pool.end();
  }
}

checkLeague();
