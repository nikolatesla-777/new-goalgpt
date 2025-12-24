import dotenv from 'dotenv';
import { pool } from './src/database/connection';

dotenv.config();

async function testInsert() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Test insert a single match
    const result = await client.query(`
      INSERT INTO ts_matches (
        external_id, competition_id, season_id, match_time, status_id,
        home_team_id, away_team_id, home_score_regular, away_score_regular
      ) VALUES (
        'TEST-001', 'TEST-COMP', 'TEST-SEASON', 1734566400, 1,
        'TEST-HOME', 'TEST-AWAY', 0, 0
      )
      ON CONFLICT (external_id) DO UPDATE SET
        match_time = EXCLUDED.match_time
      RETURNING external_id, match_time
    `);
    
    await client.query('COMMIT');
    console.log('✅ DB INSERT SUCCESS:', result.rows[0]);
    
    // Verify it exists
    const verify = await client.query('SELECT COUNT(*) as count FROM ts_matches WHERE external_id = $1', ['TEST-001']);
    console.log('✅ Verification:', verify.rows[0].count, 'match(es) found');
    
    // Clean up
    await client.query('DELETE FROM ts_matches WHERE external_id = $1', ['TEST-001']);
    console.log('✅ Test match cleaned up');
    
    process.exit(0);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ INSERT FAILED:', error.message);
    console.error('❌ Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

testInsert();







