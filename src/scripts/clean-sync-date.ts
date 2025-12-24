/**
 * Clean sync script - Deletes a day's matches and re-syncs from TheSports /match/diary
 *
 * SAFETY:
 * - Requires CONFIRM=YES env var unless --dry-run is used
 * - Date boundaries are computed for TSİ day (UTC+3) to match bulletin/day logic
 *
 * Usage:
 *   CONFIRM=YES npx tsx src/scripts/clean-sync-date.ts 2025-12-19
 *   npx tsx src/scripts/clean-sync-date.ts 2025-12-19 --dry-run
 */

import dotenv from 'dotenv';
import { pool } from '../database/connection';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { logger } from '../utils/logger';

dotenv.config();

const args = process.argv.slice(2);
const dateArg = args[0] || '2025-12-19';
const isDryRun = args.includes('--dry-run');

const TSI_OFFSET_SECONDS = 3 * 3600;

if (!isDryRun && process.env.CONFIRM !== 'YES') {
  logger.error('❌ [CleanSync] Refusing to DELETE without CONFIRM=YES. Re-run with CONFIRM=YES or use --dry-run.');
  process.exit(1);
}

async function cleanSyncDate(dateStr: string) {
  const client = await pool.connect();
  try {
    logger.info(`🚀 [CleanSync] Starting clean sync for ${dateStr}`);
    
    // Step 1: Calculate TSİ day range (UTC+3 day boundaries expressed as UTC epoch)
    const dateFormatted = dateStr.replace(/-/g, '');
    const year = parseInt(dateFormatted.substring(0, 4), 10);
    const month = parseInt(dateFormatted.substring(4, 6), 10) - 1;
    const day = parseInt(dateFormatted.substring(6, 8), 10);

    // TSİ midnight -> UTC = TSİ - 3 hours
    const startUtc = new Date(Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000);
    const endUtc = new Date(Date.UTC(year, month, day, 23, 59, 59) - TSI_OFFSET_SECONDS * 1000);

    const startUnix = Math.floor(startUtc.getTime() / 1000);
    const endUnix = Math.floor(endUtc.getTime() / 1000);

    logger.info(
      `🕒 [CleanSync] TSİ day range for ${dateStr}: UTC(${startUtc.toISOString()} .. ${endUtc.toISOString()})`
    );
    
    // Step 2: Count existing matches
    const countBefore = await client.query(`
      SELECT COUNT(*) as count 
      FROM ts_matches 
      WHERE match_time >= $1 AND match_time <= $2
    `, [startUnix, endUnix]);
    const beforeCount = parseInt(countBefore.rows[0].count, 10);
    logger.info(`📊 [CleanSync] Found ${beforeCount} existing matches for ${dateStr}`);
    
    // Step 3: Truncate matches for this date (or dry-run)
    let deletedCount = 0;

    if (isDryRun) {
      logger.warn(`🧪 [CleanSync] DRY RUN: would delete matches for ${dateStr} in range ${startUnix}-${endUnix}`);
    } else {
      await client.query('BEGIN');
      try {
        const deleteResult = await client.query(
          `
          DELETE FROM ts_matches
          WHERE match_time >= $1 AND match_time <= $2
        `,
          [startUnix, endUnix]
        );
        await client.query('COMMIT');
        deletedCount = deleteResult.rowCount || 0;
        logger.info(`🗑️ [CleanSync] Deleted ${deletedCount} matches for ${dateStr}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    
    // Step 4: Fetch from API (NO CACHE, NO FILTERS)
    const theSportsClient = new TheSportsClient();
    const matchDiaryService = new MatchDiaryService(theSportsClient);
    
    // Clear cache for this date (cache will expire naturally, but we'll skip cache check)
    logger.info(`🧹 [CleanSync] Skipping cache for fresh API fetch`);
    
    // Fetch with NO filters and NO cache
    logger.info(`📡 [CleanSync] Fetching ALL matches from API for ${dateFormatted} (NO FILTERS, NO CACHE)`);
    const response = await matchDiaryService.getMatchDiary({ date: dateFormatted, forceRefresh: true } as any);
    
    if (response.err) {
      logger.error(`❌ [CleanSync] API Error: ${response.err}`);
      process.exit(1);
    }
    
    const totalMatches = response.results?.length || 0;
    logger.info(`📦 [CleanSync] API returned ${totalMatches} matches`);
    
    if (totalMatches === 0) {
      logger.warn(`⚠️ [CleanSync] No matches returned from API. This might be normal.`);
      process.exit(0);
    }
    
    if (isDryRun) {
      logger.warn('🧪 [CleanSync] DRY RUN: will fetch & validate, but will NOT write to database.');
    }
    
    // Step 5: Populate teams and competitions FIRST
    const teamDataService = new TeamDataService(theSportsClient);
    const competitionService = new CompetitionService(theSportsClient);
    const matchSyncService = new MatchSyncService(teamDataService, competitionService);
    
    if (response.results_extra) {
      logger.info('📋 [CleanSync] Populating teams and competitions from results_extra...');
      if (response.results_extra.team) {
        await teamDataService.enrichFromResultsExtra(response.results_extra);
        logger.info(`✅ [CleanSync] Teams populated`);
      }
      if (response.results_extra.competition) {
        await competitionService.enrichFromResultsExtra(response.results_extra);
        logger.info(`✅ [CleanSync] Competitions populated`);
      }
    }
    
    // Step 6: Convert and sync ALL matches with detailed logging
    const matchesToSync = response.results.map((match: any, index: number) => {
      const homeScores = Array.isArray(match.home_scores) ? match.home_scores : [];
      const awayScores = Array.isArray(match.away_scores) ? match.away_scores : [];
      
      return {
        external_id: String(match.id ?? match.match_id),
        competition_id: match.competition_id,
        season_id: match.season_id,
        match_time: match.match_time as any,
        status_id: Number(match.status_id ?? match.status ?? 1),
        home_team_id: match.home_team_id,
        away_team_id: match.away_team_id,
        home_scores: homeScores,
        away_scores: awayScores,
        home_score_regular: (homeScores[0] ?? match.home_score) ?? null,
        away_score_regular: (awayScores[0] ?? match.away_score) ?? null,
        home_red_cards: homeScores[2] ?? null,
        away_red_cards: awayScores[2] ?? null,
        home_yellow_cards: homeScores[3] ?? null,
        away_yellow_cards: awayScores[3] ?? null,
        home_corners: homeScores[4] ?? null,
        away_corners: awayScores[4] ?? null,
        // Do not fabricate kickoff time from match_time; allow live services to set it when match goes live
        live_kickoff_time: match.live_kickoff_time ?? null,
        venue_id: match.venue_id ?? null,
        referee_id: match.referee_id ?? null,
        stage_id: match.stage_id ?? null,
        round_num: match.round_num ?? null,
        group_num: match.group_num ?? null,
      };
    });
    
    let syncResult: any = { synced: 0, errors: 0 };

    if (isDryRun) {
      logger.info(`🧪 [CleanSync] DRY RUN: Skipping DB sync for ${matchesToSync.length} matches.`);
    } else {
      logger.info(`🔄 [CleanSync] Syncing ${matchesToSync.length} matches...`);
      syncResult = await matchSyncService.syncMatches(matchesToSync as any, response.results_extra);
    }
    
    // Step 7: Verify final count
    const countAfter = await client.query(`
      SELECT COUNT(*) as count 
      FROM ts_matches 
      WHERE match_time >= $1 AND match_time <= $2
    `, [startUnix, endUnix]);
    const afterCount = parseInt(countAfter.rows[0].count, 10);
    
    logger.info(`\n📊 [CleanSync] FINAL RESULTS:`);
    logger.info(`   Before: ${beforeCount} matches`);
    logger.info(`   API returned: ${totalMatches} matches`);
    logger.info(`   Synced: ${syncResult.synced} matches`);
    logger.info(`   Errors: ${syncResult.errors} matches`);
    logger.info(`   After: ${afterCount} matches in DB`);
    const rate = totalMatches > 0 ? Math.round((syncResult.synced / totalMatches) * 100) : 0;
    logger.info(`   Deleted: ${deletedCount} matches`);
    logger.info(`   Success rate: ${rate}%`);
    
    if (afterCount !== syncResult.synced) {
      logger.warn(`⚠️ [CleanSync] Count mismatch! DB has ${afterCount} but sync reported ${syncResult.synced}`);
    }
    
    process.exit(0);
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error(`❌ [CleanSync] Failed:`, error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanSyncDate(dateArg);
