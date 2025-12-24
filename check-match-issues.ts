/**
 * Diagnostic script to check match sync issues
 * Run: npx tsx check-match-issues.ts
 */

import { pool } from './src/database/connection';
import { config } from './src/config';

async function checkIssues() {
  console.log('🔍 Checking match sync issues...\n');

  // 1. Today's matches count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startUnix = Math.floor(today.getTime() / 1000);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endUnix = Math.floor(tomorrow.getTime() / 1000);

  console.log(`📅 Date range: ${new Date(startUnix * 1000).toISOString()} to ${new Date(endUnix * 1000).toISOString()}\n`);

  // Total matches today
  const totalResult = await pool.query(
    'SELECT COUNT(*) as total FROM ts_matches WHERE match_time >= $1 AND match_time < $2',
    [startUnix, endUnix]
  );
  const totalToday = parseInt(totalResult.rows[0].total);
  console.log(`📊 Total matches today in DB: ${totalToday} (Expected: 124)`);
  console.log(`   ⚠️  Missing: ${124 - totalToday} matches\n`);

  // Status breakdown
  const statusResult = await pool.query(
    `SELECT status_id, COUNT(*) as cnt 
     FROM ts_matches 
     WHERE match_time >= $1 AND match_time < $2 
     GROUP BY status_id 
     ORDER BY status_id`,
    [startUnix, endUnix]
  );
  console.log('📈 Status breakdown:');
  statusResult.rows.forEach(row => {
    const statusNames: Record<number, string> = {
      1: 'NOT_STARTED',
      2: 'LIVE',
      3: 'HALF_TIME',
      4: 'SECOND_HALF',
      5: 'OVERTIME',
      7: 'PENALTY_SHOOTOUT',
      8: 'END'
    };
    console.log(`   Status ${row.status_id} (${statusNames[row.status_id] || 'UNKNOWN'}): ${row.cnt}`);
  });

  // Live matches (status 2,4,5,7)
  const liveResult = await pool.query(
    `SELECT COUNT(*) as live 
     FROM ts_matches 
     WHERE match_time >= $1 AND match_time < $2 
     AND status_id IN (2, 4, 5, 7)`,
    [startUnix, endUnix]
  );
  const liveCount = parseInt(liveResult.rows[0].live);
  console.log(`\n⚽ Live matches (status 2,4,5,7): ${liveCount} (Expected: ~16 based on Aiscore)`);
  console.log(`   ⚠️  Missing: ${16 - liveCount} live matches\n`);

  // Sample live matches
  if (liveCount > 0) {
    const sampleResult = await pool.query(
      `SELECT external_id, status_id, minute, home_score_regular, away_score_regular,
              TO_TIMESTAMP(match_time) AT TIME ZONE 'UTC' as match_time_utc,
              TO_TIMESTAMP(updated_at) AT TIME ZONE 'UTC' as updated_at_utc,
              provider_update_time, last_event_ts
       FROM ts_matches 
       WHERE match_time >= $1 AND match_time < $2 
       AND status_id IN (2, 4, 5, 7)
       ORDER BY match_time DESC
       LIMIT 5`,
      [startUnix, endUnix]
    );
    console.log('📋 Sample live matches:');
    sampleResult.rows.forEach(row => {
      console.log(`   ${row.external_id}: Status ${row.status_id}, Minute ${row.minute || 'N/A'}, Score ${row.home_score_regular || 0}-${row.away_score_regular || 0}`);
      console.log(`      Match time: ${row.match_time_utc}, Updated: ${row.updated_at_utc}`);
      console.log(`      Provider update: ${row.provider_update_time ? new Date(row.provider_update_time * 1000).toISOString() : 'N/A'}`);
      console.log(`      Last event: ${row.last_event_ts ? new Date(row.last_event_ts * 1000).toISOString() : 'N/A'}`);
    });
  } else {
    console.log('⚠️  No live matches found in DB!\n');
    
    // Check matches that should be live (match_time passed but status still 1)
    const shouldBeLiveResult = await pool.query(
      `SELECT COUNT(*) as cnt, 
              MIN(EXTRACT(EPOCH FROM NOW()) - match_time) as oldest_seconds_ago
       FROM ts_matches 
       WHERE match_time >= $1 AND match_time < $2 
       AND match_time <= EXTRACT(EPOCH FROM NOW())
       AND status_id = 1`,
      [startUnix, endUnix]
    );
    const shouldBeLiveCount = parseInt(shouldBeLiveResult.rows[0].cnt);
    const oldestSeconds = shouldBeLiveResult.rows[0].oldest_seconds_ago;
    if (shouldBeLiveCount > 0) {
      console.log(`⚠️  Found ${shouldBeLiveCount} matches that should be live (match_time passed but status still NOT_STARTED)`);
      console.log(`   Oldest match is ${Math.floor(oldestSeconds / 60)} minutes ago`);
      console.log(`   These matches need status update from API!\n`);
    }
  }

  // Check recent sync errors
  console.log('\n🔍 Checking sync status...');
  const recentSyncResult = await pool.query(
    `SELECT COUNT(*) as total, 
            COUNT(CASE WHEN status_id = 1 THEN 1 END) as not_started,
            COUNT(CASE WHEN status_id IN (2,4,5,7) THEN 1 END) as live,
            MAX(updated_at) as last_update
     FROM ts_matches 
     WHERE match_time >= $1 AND match_time < $2`,
    [startUnix, endUnix]
  );
  const lastUpdate = recentSyncResult.rows[0].last_update;
  console.log(`   Last update: ${lastUpdate ? new Date(lastUpdate).toISOString() : 'N/A'}`);

  // Check for matches with old updated_at (stale)
  const staleResult = await pool.query(
    `SELECT COUNT(*) as stale
     FROM ts_matches 
     WHERE match_time >= $1 AND match_time < $2 
     AND status_id IN (2, 4, 5, 7)
     AND updated_at < NOW() - INTERVAL '5 minutes'`,
    [startUnix, endUnix]
  );
  const staleCount = parseInt(staleResult.rows[0].stale);
  if (staleCount > 0) {
    console.log(`   ⚠️  ${staleCount} live matches have not been updated in 5+ minutes (may be stale)`);
  }

  console.log('\n✅ Diagnostic complete');
  await pool.end();
}

checkIssues().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});




