/**
 * Daily Diary Sync Job
 *
 * Syncs today's match diary from TheSports API to database
 * Runs at 00:00 TSİ (21:00 UTC) every day
 *
 * This ensures the bulletin (bülten) is always up-to-date
 * for the new day without requiring server restart.
 *
 * IMPORTANT: TheSports API uses UTC+8 (China) timezone for diary date filtering.
 * To get all matches for a TSI day, we must fetch BOTH today and tomorrow's diary,
 * then filter by TSI timestamp range.
 */

import { logger } from '../utils/logger';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { pool } from '../database/connection';
import { getTodayTSI } from '../utils/thesports/timestamp.util';

// TSİ (Turkey) offset: UTC+3
const TSI_OFFSET_MS = 3 * 60 * 60 * 1000;
const TSI_OFFSET_SECONDS = 3 * 60 * 60;

/**
 * Get tomorrow's date in TSİ timezone as YYYYMMDD
 * Needed because TheSports API uses UTC+8 timezone for diary filtering
 */
function getTomorrowTSI(): string {
  const tomorrowTSI = new Date(Date.now() + TSI_OFFSET_MS + 24 * 60 * 60 * 1000);
  const year = tomorrowTSI.getUTCFullYear();
  const month = String(tomorrowTSI.getUTCMonth() + 1).padStart(2, '0');
  const day = String(tomorrowTSI.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Get TSI day boundaries as Unix timestamps
 * Returns [startOfDayUTC, endOfDayUTC] for filtering matches
 */
function getTSIDayBoundaries(dateStr: string): { start: number; end: number } {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8));

  // TSI 00:00:00 = UTC (00:00:00 - 3h) = UTC previous day 21:00:00
  const startUTC = Math.floor(Date.UTC(year, month, day, 0, 0, 0) / 1000) - TSI_OFFSET_SECONDS;
  // TSI 23:59:59 = UTC (23:59:59 - 3h) = UTC 20:59:59
  const endUTC = Math.floor(Date.UTC(year, month, day, 23, 59, 59) / 1000) - TSI_OFFSET_SECONDS;

  return { start: startUTC, end: endUTC };
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
 *
 * TIMEZONE FIX: TheSports API uses UTC+8 (China) for diary date filtering.
 * A match at 20:00 TSI (17:00 UTC) is 01:00 UTC+8 (next day in China).
 * To get all TSI day matches, we fetch BOTH today AND tomorrow's diary,
 * then filter by actual TSI timestamp boundaries.
 */
export async function runDailyDiarySync(): Promise<void> {
  const startTime = Date.now();
  const dateStr = getTodayTSI();
  const tomorrowStr = getTomorrowTSI();
  const { start: tsiDayStart, end: tsiDayEnd } = getTSIDayBoundaries(dateStr);

  logger.info(`📅 [DailyDiarySync] Starting sync for date: ${dateStr} (TSİ)`);
  logger.info(`   TSI boundaries: ${new Date(tsiDayStart * 1000).toISOString()} - ${new Date(tsiDayEnd * 1000).toISOString()}`);

  try {
    // Initialize services
    const matchDiaryService = new MatchDiaryService();
    const teamDataService = new TeamDataService();
    const competitionService = new CompetitionService();
    const matchSyncService = new MatchSyncService(teamDataService, competitionService);

    // Fetch BOTH today and tomorrow's diary (TheSports uses UTC+8)
    logger.info(`🔄 [DailyDiarySync] Fetching match diary from TheSports API...`);
    logger.info(`   Fetching date=${dateStr} (today TSI) and date=${tomorrowStr} (tomorrow TSI for late matches)`);

    const [todayResponse, tomorrowResponse] = await Promise.all([
      matchDiaryService.getMatchDiary({ date: dateStr, forceRefresh: true } as any),
      matchDiaryService.getMatchDiary({ date: tomorrowStr, forceRefresh: true } as any)
    ]);

    // Log API responses
    const todayCount = todayResponse.results?.length || 0;
    const tomorrowCount = tomorrowResponse.results?.length || 0;
    logger.info(`📊 [DailyDiarySync] API returned: today=${todayCount}, tomorrow=${tomorrowCount}`);

    // Merge results from both days
    const allMatches: any[] = [];
    const seenIds = new Set<string>();

    // Add today's matches
    if (todayResponse.results) {
      for (const match of todayResponse.results) {
        const matchId = match.id || (match as any).match_id;
        if (matchId && !seenIds.has(matchId)) {
          seenIds.add(matchId);
          allMatches.push(match);
        }
      }
    }

    // Add tomorrow's matches (for late TSI matches that appear in next day's China diary)
    if (tomorrowResponse.results) {
      for (const match of tomorrowResponse.results) {
        const matchId = match.id || (match as any).match_id;
        if (matchId && !seenIds.has(matchId)) {
          seenIds.add(matchId);
          allMatches.push(match);
        }
      }
    }

    logger.info(`📊 [DailyDiarySync] Merged unique matches: ${allMatches.length}`);

    // Filter matches by TSI day boundaries
    const filteredMatches = allMatches.filter(match => {
      const matchTime = match.match_time;
      if (!matchTime) return false;
      return matchTime >= tsiDayStart && matchTime <= tsiDayEnd;
    });

    logger.info(`📊 [DailyDiarySync] After TSI filter: ${filteredMatches.length} matches for ${dateStr}`);

    if (filteredMatches.length === 0) {
      logger.warn(`⚠️ [DailyDiarySync] No matches found for ${dateStr} after TSI filtering`);
      return;
    }

    // Step 1: Populate teams and competitions from results_extra (both responses)
    for (const response of [todayResponse, tomorrowResponse]) {
      if (response.results_extra) {
        if (response.results_extra.team) {
          await teamDataService.enrichFromResultsExtra(response.results_extra);
        }
        if (response.results_extra.competition) {
          await competitionService.enrichFromResultsExtra(response.results_extra);
        }
      }
    }
    logger.info(`✅ [DailyDiarySync] Teams and competitions populated from results_extra`);

    // Step 2: Sync matches to database
    let syncedCount = 0;
    let errorCount = 0;

    for (const match of filteredMatches) {
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
