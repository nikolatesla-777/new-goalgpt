import { pool } from './src/database/connection';
import dotenv from 'dotenv';
dotenv.config();

const matchId = 'x7lm7phj0yl4m2w';
const correctMatchTime = 1766152800; // 20:00 TSİ (17:00 UTC)

async function fixMatchTime() {
  const client = await pool.connect();
  try {
    // Check current match_time
    const check = await client.query(
      'SELECT external_id, match_time, status_id FROM ts_matches WHERE external_id = $1',
      [matchId]
    );
    
    if (check.rows.length > 0) {
      const current = check.rows[0];
      console.log(`Current match_time: ${current.match_time} (${new Date(current.match_time * 1000).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })})`);
      console.log(`Current status: ${current.status_id}`);
      
      // Update match_time to 20:00 TSİ
      await client.query(
        'UPDATE ts_matches SET match_time = $1, updated_at = NOW() WHERE external_id = $2',
        [correctMatchTime, matchId]
      );
      
      console.log(`✅ Updated match_time to 20:00 TSİ (${correctMatchTime})`);
      console.log(`New time: ${new Date(correctMatchTime * 1000).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`);
    } else {
      console.log('Match not found');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

fixMatchTime().catch(console.error);






