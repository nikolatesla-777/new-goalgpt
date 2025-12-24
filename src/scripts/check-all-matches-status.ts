/**
 * Check All Matches Status Script
 * 
 * Comprehensive status check for all today's matches:
 * - Should-be-live (saati geçmiş ama NOT_STARTED)
 * - Live matches (şu an oynanan)
 * - Half-time (devre arası)
 * - Full-time (bitmiş)
 */

import dotenv from 'dotenv';
import { pool } from '../database/connection';

dotenv.config();

async function checkAllMatchesStatus() {
  const client = await pool.connect();
  try {
    const nowTs = Math.floor(Date.now() / 1000);
    
    // TSİ-based today start (UTC-3 hours)
    const TSI_OFFSET_SECONDS = 3 * 3600;
    const nowDate = new Date(nowTs * 1000);
    const year = nowDate.getUTCFullYear();
    const month = nowDate.getUTCMonth();
    const day = nowDate.getUTCDate();
    const todayStartTSI = Math.floor((Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000) / 1000);
    const todayEndTSI = todayStartTSI + 86400;

    console.log(`\n=== BUGÜNKÜ MAÇLARIN DURUMU (TSİ Bazlı) ===`);
    console.log(`Today Start (TSİ): ${new Date(todayStartTSI * 1000).toISOString()}`);
    console.log(`Now: ${new Date(nowTs * 1000).toISOString()}\n`);

    // 1. Status breakdown
    const statusQuery = `
      SELECT 
        status_id,
        COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 AND match_time < $2
      GROUP BY status_id
      ORDER BY status_id
    `;
    const statusResult = await client.query(statusQuery, [todayStartTSI, todayEndTSI]);
    
    const statusMap: Record<number, string> = {
      1: 'NOT_STARTED',
      2: 'FIRST_HALF',
      3: 'HALF_TIME',
      4: 'SECOND_HALF',
      5: 'OVERTIME',
      7: 'PENALTY',
      8: 'END',
    };

    console.log('Status Breakdown:');
    statusResult.rows.forEach(row => {
      const statusName = statusMap[row.status_id] || `STATUS_${row.status_id}`;
      console.log(`  ${statusName} (${row.status_id}): ${row.count} matches`);
    });

    // 2. Should-be-live (saati geçmiş ama NOT_STARTED)
    const shouldBeLiveQuery = `
      SELECT 
        COUNT(*) as count,
        MIN(match_time) as oldest_match_time,
        MAX(match_time) as newest_match_time
      FROM ts_matches
      WHERE match_time >= $1 
        AND match_time < $2
        AND match_time <= $3
        AND status_id = 1
    `;
    const shouldBeLiveResult = await client.query(shouldBeLiveQuery, [todayStartTSI, todayEndTSI, nowTs]);
    const shouldBeLive = shouldBeLiveResult.rows[0];
    
    console.log(`\nShould-Be-Live (saati geçmiş ama NOT_STARTED):`);
    console.log(`  Count: ${shouldBeLive.count}`);
    if (shouldBeLive.oldest_match_time) {
      const oldestMinutesAgo = Math.floor((nowTs - shouldBeLive.oldest_match_time) / 60);
      console.log(`  Oldest: ${oldestMinutesAgo} minutes ago`);
    }

    // 3. Live matches (status IN 2,3,4,5,7)
    const liveQuery = `
      SELECT COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 
        AND match_time < $2
        AND status_id IN (2, 3, 4, 5, 7)
    `;
    const liveResult = await client.query(liveQuery, [todayStartTSI, todayEndTSI]);
    console.log(`\nLive Matches (şu an oynanan):`);
    console.log(`  Count: ${liveResult.rows[0].count}`);

    // 4. Half-time (status = 3)
    const halfTimeQuery = `
      SELECT COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 
        AND match_time < $2
        AND status_id = 3
    `;
    const halfTimeResult = await client.query(halfTimeQuery, [todayStartTSI, todayEndTSI]);
    console.log(`\nHalf-Time (devre arası):`);
    console.log(`  Count: ${halfTimeResult.rows[0].count}`);

    // 5. Full-time (status = 8)
    const fullTimeQuery = `
      SELECT COUNT(*) as count
      FROM ts_matches
      WHERE match_time >= $1 
        AND match_time < $2
        AND status_id = 8
    `;
    const fullTimeResult = await client.query(fullTimeQuery, [todayStartTSI, todayEndTSI]);
    console.log(`\nFull-Time (bitmiş):`);
    console.log(`  Count: ${fullTimeResult.rows[0].count}`);

    // 6. Sample should-be-live matches
    if (shouldBeLive.count > 0) {
      const sampleQuery = `
        SELECT 
          external_id,
          match_time,
          EXTRACT(EPOCH FROM NOW()) - match_time as seconds_ago
        FROM ts_matches
        WHERE match_time >= $1 
          AND match_time < $2
          AND match_time <= $3
          AND status_id = 1
        ORDER BY match_time DESC
        LIMIT 10
      `;
      const sampleResult = await client.query(sampleQuery, [todayStartTSI, todayEndTSI, nowTs]);
      
      console.log(`\nSample Should-Be-Live Matches (first 10):`);
      sampleResult.rows.forEach(row => {
        const minutesAgo = Math.floor(row.seconds_ago / 60);
        console.log(`  ${row.external_id}: ${minutesAgo} minutes ago`);
      });
    }

  } finally {
    client.release();
  }
}

checkAllMatchesStatus().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

