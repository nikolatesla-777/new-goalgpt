/**
 * Match Status Audit Script
 * 
 * Detects and reports status inconsistencies in the database:
 * - Matches with status=1 (NOT_STARTED) but match_time has passed
 * - Status regressions (e.g., HALF_TIME → NOT_STARTED)
 * - Matches with inconsistent status between different queries
 * 
 * Usage: npx ts-node src/scripts/audit-match-status.ts
 */

import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';

interface StatusInconsistency {
  match_id: string;
  current_status: number;
  match_time: number;
  age_minutes: number;
  issue: string;
  recommendation: string;
}

async function auditMatchStatuses(): Promise<void> {
  const client = await pool.connect();
  const inconsistencies: StatusInconsistency[] = [];

  try {
    logger.info('🔍 [Audit] Starting match status audit...');
    const now = Math.floor(Date.now() / 1000);

    // 1. Find matches with status=1 (NOT_STARTED) but match_time has passed
    const query1 = `
      SELECT 
        external_id,
        status_id,
        match_time,
        updated_at,
        provider_update_time,
        last_event_ts,
        home_score_regular,
        away_score_regular
      FROM ts_matches
      WHERE match_time <= $1
        AND status_id = 1
        AND match_time >= $1 - 86400
      ORDER BY match_time DESC
      LIMIT 100
    `;

    const result1 = await client.query(query1, [now]);

    for (const row of result1.rows) {
      const matchTime = Number(row.match_time);
      const ageMinutes = Math.floor((now - matchTime) / 60);

      inconsistencies.push({
        match_id: row.external_id,
        current_status: row.status_id,
        match_time: matchTime,
        age_minutes: ageMinutes,
        issue: `Status is NOT_STARTED (1) but match_time passed ${ageMinutes} minutes ago`,
        recommendation: ageMinutes < 150 
          ? 'Match should be live or finished. Reconcile with provider API.'
          : 'Match likely finished. Check if status should be END (8).',
      });
    }

    // 2. Find potential status regressions (status went backwards)
    // Check matches that were recently updated but status seems wrong
    const query2 = `
      SELECT 
        m.external_id,
        m.status_id,
        m.match_time,
        m.updated_at,
        m.provider_update_time,
        m.last_event_ts,
        COUNT(DISTINCT m2.status_id) as status_history_count
      FROM ts_matches m
      LEFT JOIN ts_matches m2 ON m2.external_id = m.external_id 
        AND m2.updated_at < m.updated_at
        AND m2.status_id != m.status_id
      WHERE m.match_time <= $1
        AND m.match_time >= $1 - 86400
        AND m.status_id IN (1, 2, 3, 4, 5, 7, 8)
        AND m.updated_at >= NOW() - INTERVAL '1 hour'
      GROUP BY m.external_id, m.status_id, m.match_time, m.updated_at, 
               m.provider_update_time, m.last_event_ts
      HAVING m.status_id = 1 AND m.match_time <= $1 - 300
      ORDER BY m.updated_at DESC
      LIMIT 50
    `;

    const result2 = await client.query(query2, [now]);

    for (const row of result2.rows) {
      const matchTime = Number(row.match_time);
      const ageMinutes = Math.floor((now - matchTime) / 60);

      if (row.status_id === 1 && ageMinutes > 5) {
        inconsistencies.push({
          match_id: row.external_id,
          current_status: row.status_id,
          match_time: matchTime,
          age_minutes: ageMinutes,
          issue: `Potential status regression: Status is NOT_STARTED (1) but match started ${ageMinutes} minutes ago and was recently updated`,
          recommendation: 'Check if status should be live (2,3,4,5,7) or finished (8). Reconcile with provider.',
        });
      }
    }

    // 3. Find matches with HALF_TIME (3) that should have progressed
    const query3 = `
      SELECT 
        external_id,
        status_id,
        match_time,
        updated_at,
        provider_update_time,
        last_event_ts,
        first_half_kickoff_ts
      FROM ts_matches
      WHERE status_id = 3
        AND match_time <= $1
        AND match_time >= $1 - 86400
        AND (
          last_event_ts IS NULL 
          OR last_event_ts <= $1 - 900
          OR updated_at <= NOW() - INTERVAL '15 minutes'
        )
      ORDER BY match_time DESC
      LIMIT 50
    `;

    const result3 = await client.query(query3, [now]);

    for (const row of result3.rows) {
      const matchTime = Number(row.match_time);
      const firstHalfKickoff = row.first_half_kickoff_ts ? Number(row.first_half_kickoff_ts) : matchTime;
      const ageMinutes = Math.floor((now - firstHalfKickoff) / 60);

      if (ageMinutes > 60) {
        inconsistencies.push({
          match_id: row.external_id,
          current_status: row.status_id,
          match_time: matchTime,
          age_minutes: ageMinutes,
          issue: `HALF_TIME (3) status but match started ${ageMinutes} minutes ago. Should have progressed to SECOND_HALF (4) or END (8).`,
          recommendation: 'Reconcile with provider API to check if match should be SECOND_HALF (4) or END (8).',
        });
      }
    }

    // Report findings
    logger.info(`\n📊 [Audit] Found ${inconsistencies.length} status inconsistencies:\n`);

    if (inconsistencies.length === 0) {
      logger.info('✅ [Audit] No status inconsistencies found. Database is healthy.');
      return;
    }

    // Group by issue type
    const grouped = inconsistencies.reduce((acc, item) => {
      const key = item.issue.split(':')[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, StatusInconsistency[]>);

    for (const [issueType, items] of Object.entries(grouped)) {
      logger.warn(`\n⚠️  ${issueType} (${items.length} matches):`);
      items.slice(0, 10).forEach(item => {
        logger.warn(`   - ${item.match_id}: ${item.issue}`);
        logger.warn(`     Recommendation: ${item.recommendation}`);
      });
      if (items.length > 10) {
        logger.warn(`   ... and ${items.length - 10} more`);
      }
    }

    // Optionally attempt to reconcile
    if (process.env.AUTO_RECONCILE === 'true') {
      logger.info('\n🔄 [Audit] Auto-reconcile enabled. Attempting to fix inconsistencies...');
      const matchDetailLiveService = new MatchDetailLiveService(new TheSportsClient());
      
      let fixed = 0;
      let failed = 0;

      for (const item of inconsistencies.slice(0, 20)) { // Limit to 20 to avoid rate limits
        try {
          logger.info(`[Audit] Reconciling match ${item.match_id}...`);
          const result = await matchDetailLiveService.reconcileMatchToDatabase(item.match_id);
          
          if (result.updated) {
            fixed++;
            logger.info(`✅ [Audit] Fixed match ${item.match_id}: status → ${result.statusId}`);
          } else {
            logger.warn(`⚠️  [Audit] Match ${item.match_id} could not be reconciled (no update needed or API returned no data)`);
          }
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          failed++;
          logger.error(`❌ [Audit] Failed to reconcile match ${item.match_id}: ${error.message}`);
        }
      }

      logger.info(`\n📊 [Audit] Reconciliation complete: ${fixed} fixed, ${failed} failed`);
    } else {
      logger.info('\n💡 [Audit] To auto-reconcile, set AUTO_RECONCILE=true environment variable');
    }

  } catch (error: any) {
    logger.error('[Audit] Error during status audit:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  auditMatchStatuses()
    .then(() => {
      logger.info('✅ [Audit] Audit complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ [Audit] Audit failed:', error);
      process.exit(1);
    });
}

export { auditMatchStatuses };


