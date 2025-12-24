/**
 * Fetch ALL matches for a date and (optionally) sync into DB.
 *
 * Default source: /match/diary (correct full-day bulletin)
 * Optional fallback source: /match/recent/list pagination with client-side time filter (--source=recent)
 *
 * Notes:
 * - Accepts YYYY-MM-DD or YYYYMMDD
 * - If no date is provided, defaults to today's date in TSİ (UTC+3)
 *
 * Usage:
 *   npx tsx src/scripts/fetch-all-matches-date.ts 2025-12-19
 *   npx tsx src/scripts/fetch-all-matches-date.ts 20251219
 *   npx tsx src/scripts/fetch-all-matches-date.ts 2025-12-19 --source=recent
 *   npx tsx src/scripts/fetch-all-matches-date.ts 2025-12-19 --no-sync
 */

import dotenv from 'dotenv';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { logger } from '../utils/logger';
import { pool } from '../database/connection';

dotenv.config();

const args = process.argv.slice(2);
const dateArgRaw = args.find((a) => !a.startsWith('--'));
const sourceArg = args.find((a) => a.startsWith('--source=')) || '--source=diary';
const source = sourceArg.split('=')[1] || 'diary';
const noSync = args.includes('--no-sync');

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

async function fetchAllMatchesForDate(dateStr: string) {
  const client = new TheSportsClient();
  const teamDataService = new TeamDataService(client);
  const competitionService = new CompetitionService(client);
  const matchSyncService = new MatchSyncService(teamDataService, competitionService);

  try {
    const normalized = normalizeDiaryDate(dateStr);
    if (!normalized) {
      logger.error('❌ [FetchAll] Invalid date format. Use YYYY-MM-DD or YYYYMMDD.');
      process.exit(1);
    }

    const { dbDate, apiDate } = normalized;

    logger.info(`🚀 [FetchAll] Starting to fetch ALL matches for ${dbDate} (API: ${apiDate}, source=${source}, noSync=${noSync})`);

    // Calculate TSİ day range (UTC+3 day boundaries expressed as UTC epoch)
    const year = parseInt(apiDate.substring(0, 4), 10);
    const month = parseInt(apiDate.substring(4, 6), 10) - 1;
    const day = parseInt(apiDate.substring(6, 8), 10);

    const startUtc = new Date(Date.UTC(year, month, day, 0, 0, 0) - TSI_OFFSET_SECONDS * 1000);
    const endUtc = new Date(Date.UTC(year, month, day, 23, 59, 59) - TSI_OFFSET_SECONDS * 1000);

    const startUnix = Math.floor(startUtc.getTime() / 1000);
    const endUnix = Math.floor(endUtc.getTime() / 1000);

    logger.info(
      `📅 [FetchAll] TSİ Date range: ${startUnix} - ${endUnix} (UTC ${startUtc.toISOString()} to ${endUtc.toISOString()})`
    );

    let allMatches: any[] = [];
    let resultsExtra: any = null;

    if (source === 'recent') {
      // Fallback: Fetch using /match/recent/list with pagination (NO DATE FILTER - fetch all and filter client-side)
      let page = 1;
      const limit = 100; // Max per page
      let hasMore = true;
      let totalFetched = 0;

      logger.info(`📡 [FetchAll] Using source=recent. Fetching ALL pages (NO DATE FILTER - will filter client-side)...`);

      while (hasMore) {
        logger.info(`📡 [FetchAll] Fetching page ${page} (limit: ${limit})...`);

        const response = await client.get<any>('/match/recent/list', {
          page,
          limit,
        });

        const matches = response.results || [];
        logger.info(`   Page ${page}: ${matches.length} total matches fetched`);

        if (matches.length === 0) {
          hasMore = false;
          break;
        }

        // Filter matches for the target date (client-side)
        const dateMatches = matches.filter((m: any) => {
          const matchTime = m.match_time;
          return matchTime >= startUnix && matchTime <= endUnix;
        });

        if (dateMatches.length > 0) {
          logger.info(`   ✅ Found ${dateMatches.length} matches for ${dbDate} in this page`);
        }

        allMatches.push(...dateMatches);
        totalFetched += matches.length;

        if (matches.length < limit) {
          hasMore = false;
          logger.info(`   📄 Last page reached (${matches.length} < ${limit})`);
        } else {
          page++;
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      logger.info(`\n📊 [FetchAll] FINAL RESULTS (source=recent):`);
      logger.info(`   Total matches fetched (recent pages): ${totalFetched}`);
      logger.info(`   Matches in TSİ date range: ${allMatches.length}`);
    } else {
      // Default: /match/diary returns full bulletin for the day
      logger.info(`📡 [FetchAll] Using source=diary. Fetching /match/diary for ${apiDate}...`);
      const response = await client.get<any>('/match/diary', { date: apiDate });

      allMatches = response.results || [];
      resultsExtra = response.results_extra || null;

      logger.info(`\n📊 [FetchAll] FINAL RESULTS (source=diary):`);
      logger.info(`   Matches returned by diary: ${allMatches.length}`);
    }

    if (allMatches.length === 0) {
      logger.warn(`⚠️ [FetchAll] No matches found for ${dbDate} (API: ${apiDate})`);
      process.exit(0);
    }

    // Convert and sync
    const matchesToSync = allMatches.map((match: any) => {
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
        // Don't fabricate kickoff time from match_time; live services should set this when match actually goes live
        live_kickoff_time: match.live_kickoff_time ?? null,
        venue_id: match.venue_id ?? null,
        referee_id: match.referee_id ?? null,
        stage_id: match.stage_id ?? null,
        round_num: match.round_num ?? null,
        group_num: match.group_num ?? null,
      };
    });

    let syncResult: any = { synced: 0, errors: 0 };

    if (noSync) {
      logger.warn(`🧪 [FetchAll] --no-sync enabled. Skipping DB sync for ${matchesToSync.length} matches.`);
    } else {
      logger.info(`🔄 [FetchAll] Syncing ${matchesToSync.length} matches...`);
      syncResult = await matchSyncService.syncMatches(matchesToSync as any, resultsExtra || undefined);
    }

    let dbCount: number | null = null;

    if (!noSync) {
      // Verify count
      const dbClient = await pool.connect();
      const countResult = await dbClient.query(
        `
        SELECT COUNT(*) as count
        FROM ts_matches
        WHERE match_time >= $1 AND match_time <= $2
      `,
        [startUnix, endUnix]
      );
      dbCount = parseInt(countResult.rows[0].count, 10);
      dbClient.release();
    }

    logger.info(`\n✅ [FetchAll] COMPLETE for ${dbDate} (API: ${apiDate}, source=${source}):`);
    logger.info(`   Matches fetched: ${allMatches.length}`);
    logger.info(`   Matches synced: ${syncResult.synced}`);
    logger.info(`   Errors: ${syncResult.errors}`);
    if (dbCount !== null) {
      logger.info(`   DB count: ${dbCount}`);
    }

    process.exit(0);
  } catch (error: any) {
    logger.error(`❌ [FetchAll] Failed:`, error);
    process.exit(1);
  }
}

fetchAllMatchesForDate(dateArgRaw || getTodayTsi().dbDate);
