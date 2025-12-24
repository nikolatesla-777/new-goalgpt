import dotenv from 'dotenv';
import { pool } from './src/database/connection';

dotenv.config();

async function monitorSync() {
  const client = await pool.connect();
  let lastCount = 0;
  let stableCount = 0;
  
  console.log('🔍 Monitoring ts_matches table for new entries...\n');
  
  const interval = setInterval(async () => {
    try {
      const result = await client.query('SELECT COUNT(*) as count FROM ts_matches');
      const currentCount = parseInt(result.rows[0].count, 10);
      
      if (currentCount !== lastCount) {
        const diff = currentCount - lastCount;
        console.log(`✅ [${new Date().toLocaleTimeString()}] Matches: ${currentCount} (+${diff})`);
        lastCount = currentCount;
        stableCount = 0;
      } else {
        stableCount++;
        if (stableCount > 5) {
          console.log(`\n📊 Final count: ${currentCount} matches`);
          clearInterval(interval);
          client.release();
          await pool.end();
          process.exit(0);
        }
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
      clearInterval(interval);
      client.release();
      await pool.end();
      process.exit(1);
    }
  }, 1000);
  
  // Stop after 2 minutes
  setTimeout(() => {
    clearInterval(interval);
    client.release();
    pool.end();
    process.exit(0);
  }, 120000);
}

monitorSync();





