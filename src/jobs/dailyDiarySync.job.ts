/**
 * Daily Diary Sync Job
 *
 * Syncs today's match diary from TheSports API to database
 * Runs at 00:00 TSİ (21:00 UTC) every day
 *
 * This ensures the bulletin (bülten) is always up-to-date
 * for the new day without requiring server restart.
 */

import { logger } from '../utils/logger';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { pool } from '../database/connection';

// TSİ (Turkey) offset: UTC+3
const TSI_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Get today's date in TSİ timezone as YYYYMMDD
 */
function getTodayTSI(): string {
  const nowTSI = new Date(Date.now() + TSI_OFFSET_MS);
  const year = nowTSI.getUTCFullYear();
  const month = String(nowTSI.getUTCMonth() + 1).padStart(2, '0');
  const day = String(nowTSI.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Calculate display score based on algorithm
 * Case A (Overtime exists): Display = overtime_score + penalty_score
 * Case B (No Overtime): Display = regular_score + penalty_score
 */
function calculateDisplayScore(
  regularScore: number | null,
  overtimeScore: number | null,
  penaltyScore: number | null
): number {
  const regular = regularScore || 0;
  const overtime = overtimeScore || 0;
  const penalty = penaltyScore || 0;

  if (overtime > 0) {
    return overtime + penalty;
  }
  return regular + penalty;
}

/**
 * Main sync function - exports for jobManager
 */
export async function runDailyDiarySync(): Promise<void> {
  const startTime = Date.now();
  const dateStr = getTodayTSI();

  logger.info(`📅 [DailyDiarySync] Starting sync for date: ${dateStr} (TSİ)`);

  try {
    // Initialize services
    const matchDiaryService = new MatchDiaryService();
    const teamDataService = new TeamDataService();
    const competitionService = new CompetitionService();
    const matchSyncService = new MatchSyncService(teamDataService, competitionService);

    // Fetch diary from TheSports API
    logger.info(`🔄 [DailyDiarySync] Fetching match diary from TheSports API...`);
    const response = await matchDiaryService.getMatchDiary({
      date: dateStr,
      forceRefresh: true  // Skip cache, get fresh data
    } as any);

    if (response.err) {
      logger.error(`❌ [DailyDiarySync] API error: ${response.err}`);
      return;
    }

    if (!response.results || response.results.length === 0) {
      logger.warn(`⚠️ [DailyDiarySync] No matches found for ${dateStr}`);
      return;
    }

    logger.info(`📊 [DailyDiarySync] Found ${response.results.length} matches`);

    // Step 1: Populate teams and competitions from results_extra
    if (response.results_extra) {
      if (response.results_extra.team) {
        await teamDataService.enrichFromResultsExtra(response.results_extra);
        logger.info(`✅ [DailyDiarySync] Teams populated from results_extra`);
      }
      if (response.results_extra.competition) {
        await competitionService.enrichFromResultsExtra(response.results_extra);
        logger.info(`✅ [DailyDiarySync] Competitions populated from results_extra`);
      }
    }

    // Step 2: Sync matches to database
    let syncedCount = 0;
    let errorCount = 0;

    for (const match of response.results) {
      try {
        const statusId = typeof match.status === 'number' ? match.status :
                        (match.status_id || match.status || 1);

        // Extract score arrays (Array[7] format from API)
        const homeScores = (match as any).home_scores || [];
        const awayScores = (match as any).away_scores || [];

        const homeRegularScore = homeScores[0] ?? null;
        const homeOvertimeScore = homeScores[5] ?? null;
        const homePenaltyScore = homeScores[6] ?? null;

        const awayRegularScore = awayScores[0] ?? null;
        const awayOvertimeScore = awayScores[5] ?? null;
        const awayPenaltyScore = awayScores[6] ?? null;

        const homeDisplayScore = calculateDisplayScore(homeRegularScore, homeOvertimeScore, homePenaltyScore);
        const awayDisplayScore = calculateDisplayScore(awayRegularScore, awayOvertimeScore, awayPenaltyScore);

        // Upsert match to database
        await pool.query(`
          INSERT INTO ts_matches (
            external_id, season_id, competition_id, home_team_id, away_team_id,
            status_id, match_time, home_scores, away_scores,
            home_score_display, away_score_display,
            home_score_regular, away_score_regular,
            home_score_overtime, away_score_overtime,
            home_score_penalties, away_score_penalties,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
          ON CONFLICT (external_id) DO UPDATE SET
            status_id = EXCLUDED.status_id,
            home_scores = EXCLUDED.home_scores,
            away_scores = EXCLUDED.away_scores,
            home_score_display = EXCLUDED.home_score_display,
            away_score_display = EXCLUDED.away_score_display,
            home_score_regular = EXCLUDED.home_score_regular,
            away_score_regular = EXCLUDED.away_score_regular,
            home_score_overtime = EXCLUDED.home_score_overtime,
            away_score_overtime = EXCLUDED.away_score_overtime,
            home_score_penalties = EXCLUDED.home_score_penalties,
            away_score_penalties = EXCLUDED.away_score_penalties,
            updated_at = NOW()
        `, [
          match.id || (match as any).match_id,
          (match as any).season_id || null,
          match.competition_id || null,
          match.home_team_id || null,
          match.away_team_id || null,
          statusId,
          match.match_time || null,
          JSON.stringify(homeScores),
          JSON.stringify(awayScores),
          homeDisplayScore,
          awayDisplayScore,
          homeRegularScore,
          awayRegularScore,
          homeOvertimeScore,
          awayOvertimeScore,
          homePenaltyScore,
          awayPenaltyScore
        ]);

        syncedCount++;
      } catch (error: any) {
        errorCount++;
        logger.warn(`⚠️ [DailyDiarySync] Failed to sync match ${match.id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`✅ [DailyDiarySync] Completed in ${duration}ms`);
    logger.info(`   📊 Synced: ${syncedCount} matches`);
    logger.info(`   ❌ Errors: ${errorCount}`);
    logger.info(`   📅 Date: ${dateStr} (TSİ)`);

  } catch (error: any) {
    logger.error(`❌ [DailyDiarySync] Fatal error:`, error);
    throw error;
  }
}
