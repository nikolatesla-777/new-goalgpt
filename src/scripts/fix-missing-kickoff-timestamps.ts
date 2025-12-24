/**
 * Fix Missing Kickoff Timestamps (CONTROLLED)
 * 
 * This script reconciles live matches that are missing kickoff timestamps.
 * 
 * CRITICAL RULES:
 * - Only targets matches that are LIVE in DB AND have NULL kickoff timestamps
 * - Calls reconcile for each match (provider is source of truth)
 * - Does NOT change match status (status changes come from provider only)
 * - Produces proof log: "X matches fixed / Y matches remaining"
 * 
 * Usage:
 *   npx tsx src/scripts/fix-missing-kickoff-timestamps.ts
 */

import 'dotenv/config';
import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { logger } from '../utils/logger';

async function fixMissingKickoffTimestamps() {
  console.log('🔧 Fixing missing kickoff timestamps for live matches (CONTROLLED MODE)...\n');
  console.log('⚠️  This script will ONLY fix kickoff timestamps, NOT change match status.\n');

  const client = new TheSportsClient();
  const matchDetailLiveService = new MatchDetailLiveService(client);

  // Get live matches (status 2, 3, 4, 5, 7) that have NULL kickoff timestamps
  const result = await pool.query(`
    SELECT 
      external_id,
      status_id,
      minute,
      first_half_kickoff_ts,
      second_half_kickoff_ts,
      overtime_kickoff_ts,
      match_time
    FROM ts_matches
    WHERE status_id IN (2, 3, 4, 5, 7)
      AND (
        first_half_kickoff_ts IS NULL
        OR (status_id IN (4, 5, 7) AND second_half_kickoff_ts IS NULL)
      )
    ORDER BY match_time DESC
    LIMIT 50
  `);

  const matches = result.rows;
  console.log(`📋 Found ${matches.length} live matches with missing kickoff timestamps\n`);

  if (matches.length === 0) {
    console.log('✅ No matches need fixing. All live matches have required kickoff timestamps.\n');
    await pool.end();
    return;
  }

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const fixedMatchIds: string[] = [];
  const remainingMatchIds: string[] = [];

  for (const match of matches) {
    const matchId = match.external_id;
    const statusId = match.status_id;
    const needsFirstHalf = match.first_half_kickoff_ts === null;
    const needsSecondHalf = (statusId === 4 || statusId === 5 || statusId === 7) && match.second_half_kickoff_ts === null;

    console.log(`🔍 Reconciling ${matchId.substring(0, 12)} (status: ${statusId}, needs first_half: ${needsFirstHalf}, needs second_half: ${needsSecondHalf})...`);

    try {
      // CRITICAL: Only call reconcile - do NOT change status
      // reconcileMatchToDatabase will update from provider, including kickoff timestamps
      const reconcileResult = await matchDetailLiveService.reconcileMatchToDatabase(matchId);

      if (reconcileResult.rowCount > 0) {
        // Check if timestamps were set
        const checkResult = await pool.query(
          'SELECT status_id, first_half_kickoff_ts, second_half_kickoff_ts, overtime_kickoff_ts FROM ts_matches WHERE external_id = $1',
          [matchId]
        );

        const updated = checkResult.rows[0];
        const nowHasFirstHalf = updated.first_half_kickoff_ts !== null;
        const nowHasSecondHalf = updated.second_half_kickoff_ts !== null;
        const newStatusId = updated.status_id;

        // Verify status was NOT changed by this script (should only change from provider)
        if (newStatusId !== statusId) {
          console.log(`  ⚠️  Status changed by provider: ${statusId} → ${newStatusId} (this is OK, provider is source of truth)`);
        }

        if ((needsFirstHalf && nowHasFirstHalf) || (needsSecondHalf && nowHasSecondHalf)) {
          console.log(`  ✅ Fixed: first_half=${nowHasFirstHalf}, second_half=${nowHasSecondHalf}`);
          fixedCount++;
          fixedMatchIds.push(matchId);
        } else {
          console.log(`  ⚠️  Reconciled but timestamps still missing (match may be finished in provider)`);
          skippedCount++;
          remainingMatchIds.push(matchId);
        }
      } else {
        console.log(`  ⚠️  No update (match may not exist in API or already up-to-date)`);
        skippedCount++;
        remainingMatchIds.push(matchId);
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
      remainingMatchIds.push(matchId);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Proof log
  console.log(`\n✅ Complete:`);
  console.log(`   Fixed: ${fixedCount} matches`);
  console.log(`   Skipped/Remaining: ${skippedCount} matches`);
  console.log(`   Errors: ${errorCount} matches`);
  console.log(`\n📊 Proof Log:`);
  console.log(`   Fixed match IDs: ${fixedMatchIds.length > 0 ? fixedMatchIds.join(', ') : '(none)'}`);
  console.log(`   Remaining match IDs: ${remainingMatchIds.length > 0 ? remainingMatchIds.join(', ') : '(none)'}`);
  
  // Check remaining matches
  if (remainingMatchIds.length > 0) {
    const remainingCheck = await pool.query(`
      SELECT 
        external_id,
        status_id,
        first_half_kickoff_ts,
        second_half_kickoff_ts
      FROM ts_matches
      WHERE external_id = ANY($1)
    `, [remainingMatchIds]);
    
    console.log(`\n⚠️  Remaining matches status:`);
    for (const row of remainingCheck.rows) {
      console.log(`   ${row.external_id.substring(0, 12)}: status=${row.status_id}, first_half_ts=${row.first_half_kickoff_ts ? 'SET' : 'NULL'}, second_half_ts=${row.second_half_kickoff_ts ? 'SET' : 'NULL'}`);
    }
  }

  await pool.end();
}

fixMissingKickoffTimestamps().catch(console.error);

