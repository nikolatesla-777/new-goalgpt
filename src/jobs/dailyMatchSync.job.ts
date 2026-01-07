/**
 * Daily Match Sync Worker
 * 
 * Background job to sync ALL matches daily at 00:00
 * Fetches matches in batches of 50 and saves teams to database
 * This ensures all team data is pre-loaded for users
 */

import * as cron from 'node-cron';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { MatchRecentService } from '../services/thesports/match/matchRecent.service';
import { MatchDiaryService } from '../services/thesports/match/matchDiary.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
import { cacheService } from '../utils/cache/cache.service';
import { CacheKeyPrefix, CacheTTL } from '../utils/cache/types';
import { formatTheSportsDate } from '../utils/thesports/timestamp.util';
import { pool } from '../database/connection';

export class DailyMatchSyncWorker {
  private matchRecentService: MatchRecentService;
  private matchDiaryService: MatchDiaryService;
  private matchSyncService: MatchSyncService;
  private teamDataService: TeamDataService;
  private competitionService: CompetitionService;
  private cronJob: cron.ScheduledTask | null = null;
  private incrementalCronJob: cron.ScheduledTask | null = null;
  private intradayCronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  // TSİ (UTC+3) bulletin date handling (server may run in UTC)
  private static readonly TSI_OFFSET_SECONDS = 3 * 3600;
  // Ensure cron triggers are scheduled in Istanbul time (TSİ) even if the server runs in UTC
  private static readonly CRON_TIMEZONE = 'Europe/Istanbul';

  // Observability: cache last sync stats per day (no DB queries required)
  private static readonly SYNC_STATE_CACHE_TTL_SECONDS = 2 * 24 * 3600; // keep 48h

  constructor(client: TheSportsClient) {
    this.teamDataService = new TeamDataService(client);
    this.competitionService = new CompetitionService(client);
    this.matchRecentService = new MatchRecentService(client);
    this.matchDiaryService = new MatchDiaryService(client);
    this.matchSyncService = new MatchSyncService(this.teamDataService, this.competitionService);
  }

  /**
   * Returns a Date adjusted to TSİ (UTC+3) based on current timestamp.
   * This avoids "wrong day" bulletin pulls when the server runs in UTC.
   */
  private getNowTsiDate(): Date {
    const nowUtcMs = Date.now();
    const tsiMs = nowUtcMs + DailyMatchSyncWorker.TSI_OFFSET_SECONDS * 1000;
    return new Date(tsiMs);
  }

  /**
   * Returns YYYYMMDD and YYYY-MM-DD for "today" in TSİ.
   */
  private getTodayTsiStrings(): { dateStr: string; dateDisplay: string } {
    const tsi = this.getNowTsiDate();
    const dateDisplay = formatTheSportsDate(tsi); // YYYY-MM-DD
    const dateStr = dateDisplay.replace(/-/g, ''); // YYYYMMDD
    return { dateStr, dateDisplay };
  }

  // Helper: Read today's cached sync state
  private async getTodaySyncState(): Promise<any | null> {
    const { dateStr } = this.getTodayTsiStrings();
    const cacheKey = `${CacheKeyPrefix.TheSports}:match:diary:syncState:${dateStr}`;
    try {
      const state = await cacheService.get(cacheKey);
      return state ?? null;
    } catch {
      return null;
    }
  }

  // Helper: Are we in the TSİ repair window? (00:10–06:00 TSİ)
  private isInTsiRepairWindow(): boolean {
    const tsi = this.getNowTsiDate();
    const hour = tsi.getUTCHours(); // getNowTsiDate() already shifted by +3h, so UTC hours == TSİ hours
    const minute = tsi.getUTCMinutes();
    // Start at 00:10 to avoid hammering immediately after the 00:05 full sync, end at 06:00 inclusive
    if (hour < 0) return false;
    if (hour > 6) return false;
    if (hour === 0 && minute < 10) return false;
    return true;
  }

  /**
   * Get date strings for 3-day window: yesterday, today, tomorrow (TSİ)
   */
  private getThreeDayWindow(): Array<{ dateStr: string; dateDisplay: string; label: string }> {
    const tsi = this.getNowTsiDate();
    const dates: Array<{ dateStr: string; dateDisplay: string; label: string }> = [];

    // Yesterday
    const yesterday = new Date(tsi);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayDisplay = formatTheSportsDate(yesterday);
    dates.push({
      dateStr: yesterdayDisplay.replace(/-/g, ''),
      dateDisplay: yesterdayDisplay,
      label: 'YESTERDAY'
    });

    // Today
    const todayDisplay = formatTheSportsDate(tsi);
    dates.push({
      dateStr: todayDisplay.replace(/-/g, ''),
      dateDisplay: todayDisplay,
      label: 'TODAY'
    });

    // Tomorrow
    const tomorrow = new Date(tsi);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowDisplay = formatTheSportsDate(tomorrow);
    dates.push({
      dateStr: tomorrowDisplay.replace(/-/g, ''),
      dateDisplay: tomorrowDisplay,
      label: 'TOMORROW'
    });

    return dates;
  }

  /**
   * Sync 3-day window: yesterday, today, tomorrow (TSİ)
   * This ensures we have matches for the current day plus adjacent days
   */
  async syncThreeDayWindow(opts?: { reason?: string }): Promise<void> {
    const reason = opts?.reason ?? 'THREE_DAY_WINDOW';
    const window = this.getThreeDayWindow();
    const startTime = Date.now();

    logger.info(`📅 [DailyDiary] Starting 3-day window sync (${reason}):`);
    window.forEach((d, i) => {
      logger.info(`   ${i + 1}. ${d.label}: ${d.dateDisplay} (${d.dateStr})`);
    });

    const results: Array<{ date: string; matches: number; synced: number; errors: number }> = [];

    for (const dateInfo of window) {
      const syncStartTime = Date.now();
      try {
        // Track how many matches we have before sync
        const { pool } = await import('../database/connection');
        const beforeResult = await pool.query('SELECT COUNT(*) as cnt FROM ts_matches');
        const beforeCount = parseInt(beforeResult.rows[0].cnt);

        await this.syncDateDiary(dateInfo.dateStr, {
          reason: `${reason}_${dateInfo.label}`,
          batchSize: 100,
          interBatchDelayMs: 500
        });

        // Check how many matches we have after sync
        const afterResult = await pool.query('SELECT COUNT(*) as cnt FROM ts_matches');
        const afterCount = parseInt(afterResult.rows[0].cnt);

        const syncDuration = Date.now() - syncStartTime;
        const synced = afterCount - beforeCount;

        results.push({
          date: dateInfo.dateDisplay,
          matches: afterCount - beforeCount,
          synced: synced > 0 ? synced : 0,
          errors: 0
        });

        logger.info(`✅ [DailyDiary] ${dateInfo.label} (${dateInfo.dateDisplay}) sync completed in ${syncDuration}ms`);
      } catch (error: any) {
        logger.error(`❌ [DailyDiary] ${dateInfo.label} (${dateInfo.dateDisplay}) sync failed:`, error.message);
        results.push({
          date: dateInfo.dateDisplay,
          matches: 0,
          synced: 0,
          errors: 1
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const totalMatches = results.reduce((sum, r) => sum + r.matches, 0);
    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    logger.info(`✅ [DailyDiary] 3-day window sync COMPLETE:`);
    logger.info(`   D-1 (${results[0].date}): ${results[0].matches} matches, ${results[0].synced} synced`);
    logger.info(`   D (${results[1].date}): ${results[1].matches} matches, ${results[1].synced} synced`);
    logger.info(`   D+1 (${results[2].date}): ${results[2].matches} matches, ${results[2].synced} synced`);
    logger.info(`   📊 Total: ${totalMatches} matches, ${totalSynced} synced, ${totalErrors} errors`);
    logger.info(`   ⏱️  Total duration: ${totalDuration}ms`);
  }

  async syncTodayDiary(): Promise<void> {
    // Use 3-day window instead of just today
    await this.syncThreeDayWindow({ reason: 'CRON_DAILY' });
  }

  /**
   * Sync a specific day bulletin via /match/diary (YYYYMMDD).
   * Production rules:
   * - Uses TSİ day selection upstream (caller should pass TSİ-based dateStr)
   * - Retries API call (provider can lag right after midnight)
   * - Processes matches in batches for DB safety
   */
  async syncDateDiary(
    dateStr: string,
    opts?: { reason?: string; maxAttempts?: number; batchSize?: number; interBatchDelayMs?: number }
  ): Promise<void> {
    // Note: isRunning flag removed to allow parallel syncs for 3-day window
    // Each date sync is independent and idempotent (upsert)
    const reason = opts?.reason ?? 'MANUAL';
    const maxAttempts = opts?.maxAttempts ?? 3;
    const BATCH_SIZE = opts?.batchSize ?? 100;
    const interBatchDelayMs = opts?.interBatchDelayMs ?? 500;
    const syncStartTime = Date.now();

    try {
      const dateDisplay = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

      logger.info(`📅 [DailyDiary] Starting sync (${reason}) for: ${dateDisplay} (${dateStr})`);

      // --- API CALL WITH RETRY ---
      let response: any = null;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await this.matchDiaryService.getMatchDiary({ date: dateStr });
          if (response?.err) {
            lastErr = response.err;
            throw new Error(String(response.err));
          }
          break;
        } catch (e: any) {
          lastErr = e?.message ?? e;
          logger.warn(`⚠️ [DailyDiary] Attempt ${attempt}/${maxAttempts} failed for ${dateStr}: ${lastErr}`);
          if (attempt < maxAttempts) {
            // backoff: 2s, 4s, 6s...
            const waitMs = 2000 * attempt;
            await new Promise((r) => setTimeout(r, waitMs));
          }
        }
      }

      if (!response) {
        logger.error(`❌ [DailyDiary] API failed for ${dateDisplay} after ${maxAttempts} attempts: ${lastErr}`);
        return;
      }

      const totalMatches = response.results?.length || 0;
      logger.info(`📦 [DailyDiary] API returned ${totalMatches} matches for ${dateDisplay}`);

      if (totalMatches === 0) {
        logger.warn(`⚠️ [DailyDiary] No matches found for ${dateDisplay}. This might be normal.`);
        // cache state anyway for observability
        const cacheKey = `${CacheKeyPrefix.TheSports}:match:diary:syncState:${dateStr}`;
        await cacheService.set(
          cacheKey,
          {
            dateStr,
            dateDisplay,
            reason,
            ok: true,
            totalMatches: 0,
            synced: 0,
            errors: 0,
            ts: Date.now(),
          },
          DailyMatchSyncWorker.SYNC_STATE_CACHE_TTL_SECONDS
        );
        return;
      }

      // Populate teams and competitions from results_extra FIRST (before batch processing)
      if (response.results_extra) {
        logger.info('📋 [DailyDiary] Populating teams and competitions from results_extra...');
        if (response.results_extra.team) {
          await this.teamDataService.enrichFromResultsExtra(response.results_extra);
          logger.info(`✅ [DailyDiary] Teams populated`);
        }
        if (response.results_extra.competition) {
          await this.competitionService.enrichFromResultsExtra(response.results_extra);
          logger.info(`✅ [DailyDiary] Competitions populated`);
        }
      }

      // Convert all matches to sync format
      const allMatchesToSync = response.results.map((match: any) => {
        const homeScores = Array.isArray(match.home_scores) ? match.home_scores : [];
        const awayScores = Array.isArray(match.away_scores) ? match.away_scores : [];

        return {
          external_id: String(match.id),
          competition_id: match.competition_id,
          season_id: match.season_id,
          match_time: match.match_time as any,
          status_id: Number(match.status_id ?? match.status ?? 1),
          home_team_id: match.home_team_id,
          away_team_id: match.away_team_id,
          home_scores: homeScores,
          away_scores: awayScores,
          home_score_regular: homeScores[0] || match.home_score || null,
          away_score_regular: awayScores[0] || match.away_score || null,
          home_red_cards: homeScores[2] || null,
          away_red_cards: awayScores[2] || null,
          home_yellow_cards: homeScores[3] || null,
          away_yellow_cards: awayScores[3] || null,
          home_corners: homeScores[4] || null,
          away_corners: awayScores[4] || null,
          live_kickoff_time: null,
          venue_id: match.venue_id || null,
          referee_id: match.referee_id || null,
          stage_id: match.stage_id || null,
          // CRITICAL FIX: Ensure integer fields are properly typed (null or number, never string/undefined)
          round_num: match.round_num != null ? Number(match.round_num) : null,
          group_num: match.group_num != null ? Number(match.group_num) : null,
        };
      });

      if (allMatchesToSync.length > 0) {
        const sample = allMatchesToSync[0];
        logger.info(
          `🔎 [DailyDiary] Sample match alignment: external_id=${sample.external_id}, ` +
          `match_time=${sample.match_time}, status_id=${sample.status_id}`
        );
      }

      // --- BATCH PROCESSING ---
      const totalBatches = Math.ceil(allMatchesToSync.length / BATCH_SIZE);
      let totalSynced = 0;
      let totalErrors = 0;

      logger.info(
        `🔄 [DailyDiary] Processing ${allMatchesToSync.length} matches in ${totalBatches} batches (${BATCH_SIZE} per batch)`
      );

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, allMatchesToSync.length);
        const batch = allMatchesToSync.slice(startIndex, endIndex);
        const batchNumber = batchIndex + 1;

        try {
          logger.info(
            `📦 [DailyDiary] Processing batch ${batchNumber}/${totalBatches} (matches ${startIndex + 1}-${endIndex})...`
          );

          const syncResult = await this.matchSyncService.syncMatches(batch as any, response.results_extra);

          totalSynced += syncResult.synced || 0;
          totalErrors += syncResult.errors || 0;

          // Log batch summary with rejection reasons if any
          if (syncResult.rejectedReasons && Object.keys(syncResult.rejectedReasons).length > 0) {
            const reasons = Object.entries(syncResult.rejectedReasons)
              .map(([r, c]) => `${r}:${c}`)
              .join(', ');
            logger.info(
              `✅ [DailyDiary] Batch ${batchNumber}/${totalBatches} completed: ${syncResult.synced} synced, ${syncResult.errors || 0
              } errors (${reasons})`
            );
          } else {
            logger.info(
              `✅ [DailyDiary] Batch ${batchNumber}/${totalBatches} completed: ${syncResult.synced} synced, ${syncResult.errors || 0
              } errors`
            );
          }

          // Small delay between batches to avoid overwhelming the database
          if (batchIndex < totalBatches - 1) {
            await new Promise((resolve) => setTimeout(resolve, interBatchDelayMs));
          }
        } catch (error: any) {
          logger.error(`❌ [DailyDiary] Batch ${batchNumber}/${totalBatches} failed:`, error.message);
          totalErrors += batch.length;
          // Continue with next batch even if this one failed
        }
      }

      const successRate = Math.round((totalSynced / totalMatches) * 100);

      logger.info(`✅ [DailyDiary] SYNC COMPLETE for ${dateDisplay}:`);
      logger.info(`   📊 Total matches: ${totalMatches}`);
      logger.info(`   ✅ Synced: ${totalSynced}`);
      logger.info(`   ❌ Errors: ${totalErrors}`);
      logger.info(`   📈 Success rate: ${successRate}%`);

      // --- PRE-SYNC: H2H, Lineups, Standings for NOT_STARTED matches ---
      // This runs after match sync completes, only for matches that haven't started yet
      try {
        const { DailyPreSyncService } = await import('../services/thesports/sync/dailyPreSync.service');
        const { theSportsAPI } = await import('../core');
        // SINGLETON: Use shared API client with global rate limiting
        const preSyncService = new DailyPreSyncService(theSportsAPI as any);

        // Get NOT_STARTED matches from database for this date
        const client = await pool.connect();
        try {
          const matchTimeStart = new Date(`${dateDisplay}T00:00:00Z`).getTime() / 1000;
          const matchTimeEnd = matchTimeStart + 86400; // +24 hours

          const notStartedMatches = await client.query(
            `SELECT external_id, season_id 
             FROM ts_matches 
             WHERE match_time >= $1 AND match_time < $2 
             AND status_id = 1
             ORDER BY match_time ASC`,
            [matchTimeStart, matchTimeEnd]
          );

          if (notStartedMatches.rows.length > 0) {
            logger.info(`🔄 [DailyDiary] Starting pre-sync for ${notStartedMatches.rows.length} NOT_STARTED matches (H2H, Lineups, Standings)`);

            const matchIds = notStartedMatches.rows.map((r: any) => r.external_id).filter(Boolean);
            const seasonIds = [...new Set(notStartedMatches.rows.map((r: any) => r.season_id).filter(Boolean))];

            const preSyncResult = await preSyncService.runPreSync(matchIds, seasonIds);

            logger.info(`✅ [DailyDiary] Pre-sync complete: H2H=${preSyncResult.h2hSynced}, Lineups=${preSyncResult.lineupsSynced}, Standings=${preSyncResult.standingsSynced}`);

            if (preSyncResult.errors.length > 0) {
              logger.warn(`⚠️ [DailyDiary] Pre-sync errors: ${preSyncResult.errors.length}`);
              preSyncResult.errors.slice(0, 10).forEach((err: string) => logger.warn(`  - ${err}`));
            }
          } else {
            logger.debug(`ℹ️ [DailyDiary] No NOT_STARTED matches found for pre-sync`);
          }
        } finally {
          client.release();
        }
      } catch (preSyncError: any) {
        // Don't fail the entire sync if pre-sync fails
        logger.error(`❌ [DailyDiary] Pre-sync failed (non-blocking):`, preSyncError.message);
      }

      // Cache sync state for observability (48h)
      const cacheKey = `${CacheKeyPrefix.TheSports}:match:diary:syncState:${dateStr}`;
      await cacheService.set(
        cacheKey,
        {
          dateStr,
          dateDisplay,
          reason,
          ok: true,
          totalMatches,
          synced: totalSynced,
          errors: totalErrors,
          successRate,
          ts: Date.now(),
        },
        DailyMatchSyncWorker.SYNC_STATE_CACHE_TTL_SECONDS
      );
    } catch (error: any) {
      logger.error('❌ [DailyDiary] Sync failed:', error);
      // Cache failure state too
      try {
        const dateDisplay = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        const cacheKey = `${CacheKeyPrefix.TheSports}:match:diary:syncState:${dateStr}`;
        await cacheService.set(
          cacheKey,
          {
            dateStr,
            dateDisplay,
            ok: false,
            reason,
            error: error?.message ?? String(error),
            ts: Date.now(),
          },
          DailyMatchSyncWorker.SYNC_STATE_CACHE_TTL_SECONDS
        );
      } catch {
        // ignore cache failures
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync all matches in batches
   */
  async syncAllMatches(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Daily match sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting daily match sync job...');

      let page = 1;
      const limit = 50;
      let totalMatches = 0;
      let totalTeams = 0;
      let totalCompetitions = 0;
      let hasMore = true;

      while (hasMore) {
        try {
          logger.info(`Fetching matches: page=${page}, limit=${limit}`);

          // Fetch matches
          const response = await this.matchRecentService.getMatchRecentList({
            page,
            limit,
          });

          // Check for errors
          if (response.err) {
            logger.error(`Error fetching matches page ${page}: ${response.err}`);
            break;
          }

          if (!response.results || response.results.length === 0) {
            hasMore = false;
            break;
          }

          const matches = response.results;
          totalMatches += matches.length;

          // Collect all team and competition IDs
          const teamIds = new Set<string>();
          const competitionIds = new Set<string>();

          matches.forEach(match => {
            if (match.home_team_id != null) teamIds.add(String(match.home_team_id));
            if (match.away_team_id != null) teamIds.add(String(match.away_team_id));
            if (match.competition_id != null) competitionIds.add(String(match.competition_id));
          });

          // Batch fetch and save teams
          if (teamIds.size > 0) {
            logger.info(`Fetching ${teamIds.size} teams for page ${page}...`);
            const teams = await this.teamDataService.getTeamsByIds(Array.from(teamIds));

            // Fetch missing teams from API (getTeamById saves to DB)
            const missingTeamIds = Array.from(teamIds).filter(id => !teams.has(id));
            if (missingTeamIds.length > 0) {
              logger.info(`Fetching ${missingTeamIds.length} missing teams from API...`);
              for (const teamId of missingTeamIds) {
                try {
                  await this.teamDataService.getTeamById(teamId); // This saves to DB
                  totalTeams++;
                } catch (error: any) {
                  logger.warn(`Failed to fetch team ${teamId}:`, error.message);
                }
              }
            }

            totalTeams += teams.size;
            logger.debug(`Processed ${teams.size} teams from cache/DB, ${missingTeamIds.length} from API`);
          }

          // Batch fetch competitions (competitions are cached, no need to save individually)
          if (competitionIds.size > 0) {
            logger.info(`Fetching ${competitionIds.size} competitions for page ${page}...`);
            const competitions = await this.competitionService.getCompetitionsByIds(Array.from(competitionIds));
            totalCompetitions += competitions.size;
            logger.debug(`Loaded ${competitions.size} competitions from cache`);
          }

          // Cache this page
          const cacheKey = `${CacheKeyPrefix.TheSports}:match:recent:page:${page}:limit:${limit}`;
          await cacheService.set(cacheKey, response, CacheTTL.Day);

          logger.info(`Page ${page} synced: ${matches.length} matches, ${teamIds.size} teams, ${competitionIds.size} competitions`);

          // Check if there are more pages
          const totalPages = response.pagination?.total
            ? Math.ceil(response.pagination.total / limit)
            : null;

          if (totalPages && page >= totalPages) {
            hasMore = false;
          } else if (matches.length < limit) {
            hasMore = false;
          } else {
            page++;
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error: any) {
          logger.error(`Error syncing page ${page}:`, error);
          // Continue with next page
          page++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      logger.info(`Daily match sync completed: ${totalMatches} matches, ${totalTeams} teams, ${totalCompetitions} competitions`);
    } catch (error: any) {
      logger.error('Daily match sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Daily match sync worker already started');
      return;
    }

    // CRITICAL: Run every day at 00:05 (5 minutes after midnight)
    // This ensures the new day's data is fully available in the API
    this.cronJob = cron.schedule(
      '5 0 * * *',
      async () => {
        logger.info('🔄 [DailyDiary] CRON TRIGGERED: Starting new day sync at 00:05 (TSİ bulletin)');
        await this.syncTodayDiary();

        // Sync countries daily (rarely changes, but ensures we have all country data)
        try {
          const { CountrySyncService } = await import('../services/thesports/country/countrySync.service');
          const countrySyncService = new CountrySyncService();
          logger.info('🌍 [DailyDiary] Starting daily country sync...');
          const countryResult = await countrySyncService.syncAllCountries();
          logger.info(`✅ [DailyDiary] Country sync complete: ${countryResult.synced} synced, ${countryResult.errors} errors`);
        } catch (countryError: any) {
          logger.error('❌ [DailyDiary] Country sync failed (non-blocking):', countryError.message);
        }
      },
      { timezone: DailyMatchSyncWorker.CRON_TIMEZONE }
    );

    // Live Catch-up sync: Every 5 minutes (Increased from 30m for real-time status protection)
    // We run this all day to catch transitions (NOT_STARTED -> LIVE) that incremental sync might miss.
    this.incrementalCronJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        if (this.isRunning) return;

        logger.info('🔄 [DailyDiary] LIVE CATCH-UP: Syncing today\'s diary for status updates...');
        const { dateStr } = this.getTodayTsiStrings();
        await this.syncDateDiary(dateStr, { reason: 'LIVE_CATCHUP', maxAttempts: 3, batchSize: 100, interBatchDelayMs: 500 });
      },
      { timezone: DailyMatchSyncWorker.CRON_TIMEZONE }
    );

    // Intraday sync: Every 4 hours to catch new matches added during the day
    this.intradayCronJob = cron.schedule(
      '5 4,8,12,16,20 * * *',
      async () => {
        if (this.isRunning) return;

        logger.info('🔄 [DailyDiary] INTRADAY SYNC: Running 4-hour diary refresh...');
        await this.syncThreeDayWindow({ reason: 'INTRADAY_4H' });
      },
      { timezone: DailyMatchSyncWorker.CRON_TIMEZONE }
    );

    const { dateStr: startDateStr, dateDisplay: startDateDisplay } = this.getTodayTsiStrings();
    logEvent('info', 'worker.started', {
      worker: 'DailyMatchSyncWorker',
      schedule: '5 0 * * *, */30 * * *, 5 4,8,12,16,20 * * *',
    });
    logger.info(`   🕒 Cron timezone: ${DailyMatchSyncWorker.CRON_TIMEZONE}`);
    logger.info(`   🗓️ Today (TSİ): ${startDateDisplay} (${startDateStr})`);
    logger.info(`   🌍 Server TZ offset (minutes): ${new Date().getTimezoneOffset()}`);
    logger.info('   📅 Full sync: Every day at 00:05 (3-day window: yesterday/today/tomorrow)');
    logger.info('   🛠️ Repair: Every 30 minutes (00:10–06:00 TSİ, only if needed)');
    logger.info('   🔄 Intraday: Every 4 hours (04:05, 08:05, 12:05, 16:05, 20:05 TSİ)');

    // Run immediately on start to sync 3-day window
    setTimeout(() => {
      this.syncThreeDayWindow({ reason: 'STARTUP' });
    }, 5000); // 5 second delay after server start
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.incrementalCronJob) {
      this.incrementalCronJob.stop();
      this.incrementalCronJob = null;
    }
    if (this.intradayCronJob) {
      this.intradayCronJob.stop();
      this.intradayCronJob = null;
    }
    logger.info('Daily match sync worker stopped');
  }

  /**
   * Manually trigger sync (for testing)
   */
  async triggerSync(): Promise<void> {
    await this.syncThreeDayWindow({ reason: 'MANUAL_TRIGGER' });
  }
}
