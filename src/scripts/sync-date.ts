/**
 * Script to sync matches for a specific day from TheSports /match/diary
 *
 * Notes:
 * - Accepts YYYY-MM-DD or YYYYMMDD
 * - If no date is provided, defaults to today's date in TSİ (UTC+3)
 *
 * Usage:
 *   npx tsx src/scripts/sync-date.ts 2025-12-19
 *   npx tsx src/scripts/sync-date.ts 20251219
 */

import dotenv from 'dotenv';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { logger } from '../utils/logger';

dotenv.config();

const TSI_OFFSET_SECONDS = 3 * 3600;

const getTodayTsi = (): { dbDate: string; apiDate: string } => {
  const tsiMs = Date.now() + TSI_OFFSET_SECONDS * 1000;
  const d = new Date(tsiMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const dbDate = `${yyyy}-${mm}-${dd}`;
  const apiDate = `${yyyy}${mm}${dd}`;
  return { dbDate, apiDate };
};

const normalizeDiaryDate = (input?: string): { dbDate: string; apiDate: string } | null => {
  if (!input) return getTodayTsi();

  const raw = String(input).trim();

  if (/^\d{8}$/.test(raw)) {
    const dbDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return { dbDate, apiDate: raw };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { dbDate: raw, apiDate: raw.replace(/-/g, '') };
  }

  return null;
};

async function syncDate(dateStr: string) {
  try {
    const normalized = normalizeDiaryDate(dateStr);
    if (!normalized) {
      logger.error('❌ Invalid date format. Use YYYY-MM-DD or YYYYMMDD.');
      process.exit(1);
    }

    const { dbDate, apiDate } = normalized;

    logger.info(`🚀 Starting sync for date: ${dbDate} (API: ${apiDate})`);
    
    const client = new TheSportsClient();
    const teamDataService = new TeamDataService(client);
    const competitionService = new CompetitionService(client);
    const matchSyncService = new MatchSyncService(teamDataService, competitionService);
    const matchDiaryService = new MatchDiaryService(client);

    logger.info(`📅 Fetching match diary for date: ${apiDate}`);
    const response = await matchDiaryService.getMatchDiary({ date: apiDate as any });

    if (response.err) {
      logger.error(`❌ Failed to fetch matches: ${response.err}`);
      process.exit(1);
    }

    if (!response.results || response.results.length === 0) {
      logger.warn(`⚠️ No matches found for date ${dbDate} (API: ${apiDate})`);
      process.exit(0);
    }

    logger.info(`✅ Found ${response.results.length} matches. Syncing...`);

    // Populate teams and competitions from results_extra FIRST
    if (response.results_extra) {
      logger.info('📋 Populating teams and competitions from results_extra...');
      
      if (response.results_extra.team) {
        await teamDataService.enrichFromResultsExtra(response.results_extra);
        logger.info('✅ Teams populated');
      }
      
      if (response.results_extra.competition) {
        await competitionService.enrichFromResultsExtra(response.results_extra);
        logger.info('✅ Competitions populated');
      }
    }

    // Convert and sync matches
    const matchesToSync = response.results.map((match: any) => {
      // Extract scores from home_scores/away_scores arrays (Array[7] format)
      const homeScores = Array.isArray(match.home_scores) ? match.home_scores : [];
      const awayScores = Array.isArray(match.away_scores) ? match.away_scores : [];
      
      return {
        external_id: String(match.id ?? match.match_id),
        competition_id: match.competition_id,
        season_id: match.season_id,
        match_time: match.match_time,
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
        // Don't fabricate kickoff time from match_time; live services should set this when match actually goes live
        live_kickoff_time: match.live_kickoff_time ?? null,
        venue_id: match.venue_id ?? null,
        referee_id: match.referee_id ?? null,
        stage_id: match.stage_id ?? null,
        round_num: match.round_num ?? null,
        group_num: match.group_num ?? null,
      };
    });

    logger.info(`🔄 Syncing ${matchesToSync.length} matches...`);
    await matchSyncService.syncMatches(matchesToSync, response.results_extra);
    
    logger.info(`✅ Successfully synced ${matchesToSync.length} matches for ${dbDate} (API: ${apiDate})`);
    process.exit(0);
  } catch (error: any) {
    logger.error(`❌ Sync failed:`, error);
    process.exit(1);
  }
}

const dateArg = process.argv[2];
syncDate(dateArg || getTodayTsi().dbDate);
