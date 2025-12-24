import { pool } from './src/database/connection';
import dotenv from 'dotenv';
dotenv.config();

const matchId = 'x7lm7phj0yl4m2w';

async function fixMatchStatus() {
  const client = await pool.connect();
  try {
    // Check current status and match_time
    const check = await client.query(
      'SELECT external_id, match_time, status_id FROM ts_matches WHERE external_id = $1',
      [matchId]
    );
    
    if (check.rows.length > 0) {
      const current = check.rows[0];
      const matchTime = parseInt(current.match_time);
      const now = Math.floor(Date.now() / 1000);
      const minutesPassed = Math.floor((now - matchTime) / 60);
      
      console.log(`Current status: ${current.status_id} (1=NOT_STARTED)`);
      console.log(`Match time: ${new Date(matchTime * 1000).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`);
      console.log(`Minutes passed: ${minutesPassed}`);
      
      // If match started more than 5 minutes ago, update status
      if (minutesPassed > 5 && current.status_id === 1) {
        let newStatus = 2; // FIRST_HALF
        if (minutesPassed > 120) {
          newStatus = 8; // END
        } else if (minutesPassed > 60) {
          newStatus = 4; // SECOND_HALF
        } else if (minutesPassed > 45) {
          newStatus = 3; // HALF_TIME
        }
        
        await client.query(
          'UPDATE ts_matches SET status_id = $1, updated_at = NOW() WHERE external_id = $2',
          [newStatus, matchId]
        );
        
        console.log(`✅ Updated status from ${current.status_id} to ${newStatus}`);
      } else {
        console.log('Status is already correct or match hasn\'t started yet');
      }
    } else {
      console.log('Match not found');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

fixMatchStatus().catch(console.error);





