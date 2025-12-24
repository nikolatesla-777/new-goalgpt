import dotenv from 'dotenv';
import { pool } from './src/database/connection';

dotenv.config();

async function checkCount() {
  const client = await pool.connect();
  try {
    // Count all matches
    const totalResult = await client.query('SELECT COUNT(*) as count FROM ts_matches');
    const total = parseInt(totalResult.rows[0].count, 10);
    
    // Count matches for 2025-12-19 (using correct UTC date range)
    const dateStr = '20251219';
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59));
    const startUnix = Math.floor(startOfDay.getTime() / 1000);
    const endUnix = Math.floor(endOfDay.getTime() / 1000);
    
    const dateResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM ts_matches 
      WHERE match_time >= $1 AND match_time <= $2
    `, [startUnix, endUnix]);
    const dateCount = parseInt(dateResult.rows[0].count, 10);
    
    console.log(`📊 Total matches in ts_matches: ${total}`);
    console.log(`📅 Matches for 2025-12-19: ${dateCount}`);
    
    // Check competitions
    const compResult = await client.query('SELECT COUNT(*) as count FROM ts_competitions');
    const compCount = parseInt(compResult.rows[0].count, 10);
    console.log(`🏆 Total competitions: ${compCount}`);
    
    // Check teams
    const teamResult = await client.query('SELECT COUNT(*) as count FROM ts_teams');
    const teamCount = parseInt(teamResult.rows[0].count, 10);
    console.log(`⚽ Total teams: ${teamCount}`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkCount();

