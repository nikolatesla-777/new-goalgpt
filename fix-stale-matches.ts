/**
 * Fix stale matches: Reconcile matches that should be live but status is still NOT_STARTED
 * Run: npx tsx fix-stale-matches.ts
 */

import { pool } from './src/database/connection';
import { MatchDetailLiveService } from './src/services/thesports/match/matchDetailLive.service';
import { TheSportsClient } from './src/services/thesports/client/thesports-client';

async function fixStaleMatches() {
  console.log('🔧 Fixing stale matches...\n');

  const client = await pool.connect();
  try {
    const now = Math.floor(Date.now() / 1000);
    const todayStart = Math.floor(now / 86400) * 86400; // Today 00:00 UTC

    // Find matches that should be live (match_time passed but status still NOT_STARTED)
    const shouldBeLiveResult = await client.query(
      `SELECT external_id, match_time, 
              EXTRACT(EPOCH FROM NOW()) - match_time as seconds_ago
       FROM ts_matches
       WHERE match_time <= $1
         AND match_time >= $2
         AND status_id = 1  -- NOT_STARTED but match_time has passed
       ORDER BY match_time DESC
       LIMIT 50`,
      [now, todayStart]
    );

    const staleMatches = shouldBeLiveResult.rows;
    console.log(`📋 Found ${staleMatches.length} stale matches\n`);

    if (staleMatches.length === 0) {
      console.log('✅ No stale matches found');
      return;
    }

    // Initialize services
    const theSportsClient = new TheSportsClient();
    const matchDetailLiveService = new MatchDetailLiveService(theSportsClient);

    let updated = 0;
    let failed = 0;
    let skipped = 0;

    for (const match of staleMatches) {
      const matchId = match.external_id;
      const secondsAgo = Math.floor(match.seconds_ago);
      const minutesAgo = Math.floor(secondsAgo / 60);

      console.log(`\n🔍 Processing: ${matchId} (${minutesAgo} minutes ago)`);

      try {
        // Reconcile match (this will fetch from API and update status)
        const result = await matchDetailLiveService.reconcileMatchToDatabase(matchId, null);

        if (result.rowCount > 0) {
          // Check new status
          const statusResult = await client.query(
            'SELECT status_id, minute FROM ts_matches WHERE external_id = $1',
            [matchId]
          );
          const newStatus = statusResult.rows[0]?.status_id;
          const minute = statusResult.rows[0]?.minute;

          console.log(`  ✅ Updated: Status ${newStatus}, Minute ${minute || 'N/A'}`);
          updated++;
        } else {
          console.log(`  ⚠️  No update (match may not exist in API or already up-to-date)`);
          skipped++;
        }
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        failed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Fix complete:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Failed: ${failed}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixStaleMatches().catch(e => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});


