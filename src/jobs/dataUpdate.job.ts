/**
 * Data Update Worker
 *
 * Background job to check for real-time updates from TheSports API
 * Runs every 20 seconds to keep local database fresh (per TheSports docs)
 */

import { DataUpdateService } from '../services/thesports/dataUpdate/dataUpdate.service';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { CombinedStatsService } from '../services/thesports/match/combinedStats.service';
import { MatchTrendService } from '../services/thesports/match/matchTrend.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
// SINGLETON: Use shared API client for global rate limiting
import { theSportsAPI } from '../core';
// PHASE C: Use LiveMatchOrchestrator for centralized write coordination
import { LiveMatchOrchestrator, FieldUpdate } from '../services/orchestration/LiveMatchOrchestrator';


export class DataUpdateWorker {
  private dataUpdateService: DataUpdateService;
  private matchDetailLiveService: MatchDetailLiveService;
  private combinedStatsService: CombinedStatsService;
  private matchTrendService: MatchTrendService;
  private orchestrator: LiveMatchOrchestrator;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.dataUpdateService = new DataUpdateService();
    // SINGLETON: All services share the same API client with global rate limiting
    this.matchDetailLiveService = new MatchDetailLiveService();
    this.combinedStatsService = new CombinedStatsService();
    this.matchTrendService = new MatchTrendService();
    this.orchestrator = LiveMatchOrchestrator.getInstance();
  }

  /**
   * Normalize changed matches from various payload formats
   * Supports:
   * - payload.changed_matches / changed_match_ids / matches (legacy)
   * - payload.results["1"] and other keys containing arrays with match_id and update_time
   * 
   * Returns: { matchIds: string[], updateTimeByMatchId: Map<string, number> }
   */
  private normalizeChangedMatches(payload: any): {
    matchIds: string[];
    updateTimeByMatchId: Map<string, number>;
  } {
    const matchIds: string[] = [];
    const updateTimeByMatchId = new Map<string, number>();

    if (!payload || typeof payload !== 'object') {
      return { matchIds, updateTimeByMatchId };
    }

    // Helper to extract match_id and update_time from an item
    const extractMatchInfo = (item: any): { matchId: string | null; updateTime: number | null } => {
      if (item == null) return { matchId: null, updateTime: null };

      let matchId: string | null = null;
      if (typeof item === 'string' || typeof item === 'number') {
        matchId = String(item);
      } else if (typeof item === 'object') {
        matchId = item.match_id != null
          ? String(item.match_id)
          : item.id != null
            ? String(item.id)
            : null;
      }

      let updateTime: number | null = null;
      if (typeof item === 'object' && item != null) {
        const ut = item.update_time ?? item.updateTime ?? item.ut ?? item.ts ?? item.timestamp;
        if (typeof ut === 'number' && ut > 0) {
          // If milliseconds (>= year 2000 in ms), convert to seconds
          updateTime = ut >= 946684800000 ? Math.floor(ut / 1000) : ut;
        } else if (typeof ut === 'string') {
          const parsed = parseInt(ut, 10);
          if (!isNaN(parsed) && parsed > 0) {
            updateTime = parsed >= 946684800000 ? Math.floor(parsed / 1000) : parsed;
          }
        }
      }

      return { matchId, updateTime };
    };

    // Legacy formats: changed_matches, changed_match_ids, matches
    const legacyRaw =
      payload?.changed_matches ??
      payload?.changed_match_ids ??
      payload?.matches;

    if (Array.isArray(legacyRaw)) {
      for (const item of legacyRaw) {
        const { matchId, updateTime } = extractMatchInfo(item);
        if (matchId) {
          matchIds.push(matchId);
          if (updateTime !== null) {
            updateTimeByMatchId.set(matchId, updateTime);
          }
        }
      }
    }

    // New format: results["1"], results["2"], etc. containing arrays with match_id and update_time
    const resultsObj = payload?.results;
    if (resultsObj && typeof resultsObj === 'object' && !Array.isArray(resultsObj)) {
      // Iterate through all keys in results (e.g., "1", "2", etc.)
      for (const key of Object.keys(resultsObj)) {
        const value = resultsObj[key];
        if (Array.isArray(value)) {
          for (const item of value) {
            const { matchId, updateTime } = extractMatchInfo(item);
            if (matchId) {
              matchIds.push(matchId);
              if (updateTime !== null) {
                updateTimeByMatchId.set(matchId, updateTime);
              }
            }
          }
        }
      }
    }

    // Deduplicate matchIds (keep first occurrence)
    const uniqueMatchIds = Array.from(new Set(matchIds));

    return { matchIds: uniqueMatchIds, updateTimeByMatchId };
  }

  /**
   * PHASE C: Reconcile match via LiveMatchOrchestrator
   *
   * Fetches match detail_live from API and sends updates to orchestrator
   * for centralized write coordination.
   */
  private async reconcileViaOrchestrator(matchId: string, providerUpdateTime: number | null): Promise<void> {
    try {
      // Step 1: Fetch match detail_live from API
      const resp = await this.matchDetailLiveService.getMatchDetailLive(
        { match_id: matchId },
        { forceRefresh: true }
      );

      // Step 2: Extract fields from response
      const results = (resp as any).results || (resp as any).result_list;
      if (!results || !Array.isArray(results)) {
        logger.warn(`[DataUpdate.orchestrator] No results for match ${matchId}`);
        return;
      }

      const matchData = results.find((m: any) => String(m?.id || m?.match_id) === String(matchId));
      if (!matchData) {
        logger.warn(`[DataUpdate.orchestrator] Match ${matchId} not found in results`);
        return;
      }

      // Step 3: Parse fields using extractLiveFields() for proper field extraction
      const updates: FieldUpdate[] = [];
      const now = Math.floor(Date.now() / 1000);

      // CRITICAL FIX: Use extractLiveFields() to handle various API field name variations
      const live = this.matchDetailLiveService.extractLiveFields(resp, matchId);

      // Parse score array: [home_score, status_id, [home_display, ...], [away_display, ...]]
      if (Array.isArray(matchData.score) && matchData.score.length >= 4) {
        const homeScore = matchData.score[0];
        const statusId = matchData.score[1];
        const homeScoreDisplay = Array.isArray(matchData.score[2]) ? matchData.score[2][0] : null;
        const awayScoreDisplay = Array.isArray(matchData.score[3]) ? matchData.score[3][0] : null;

        if (homeScoreDisplay !== null) {
          updates.push({
            field: 'home_score_display',
            value: homeScoreDisplay,
            source: 'api',
            priority: 2,
            timestamp: live.updateTime || providerUpdateTime || now,
          });
        }

        if (awayScoreDisplay !== null) {
          updates.push({
            field: 'away_score_display',
            value: awayScoreDisplay,
            source: 'api',
            priority: 2,
            timestamp: live.updateTime || providerUpdateTime || now,
          });
        }

        if (statusId !== null && statusId !== undefined) {
          updates.push({
            field: 'status_id',
            value: statusId,
            source: 'api',
            priority: 2,
            timestamp: live.updateTime || providerUpdateTime || now,
          });
        }
      }

      // Minute (if available)
      if (matchData.minute !== null && matchData.minute !== undefined) {
        updates.push({
          field: 'minute',
          value: matchData.minute,
          source: 'api',
          priority: 2,
          timestamp: live.updateTime || providerUpdateTime || now,
        });
      }

      // CRITICAL FIX: Provider timestamps from extractLiveFields()
      // If API doesn't provide update_time, use current timestamp (ingestion time)
      // The fact that we're processing this match means API returned fresh data
      const effectiveUpdateTime = live.updateTime !== null ? live.updateTime : now;

      updates.push({
        field: 'provider_update_time',
        value: effectiveUpdateTime,
        source: 'api',
        priority: 2,
        timestamp: effectiveUpdateTime,
      });

      updates.push({
        field: 'last_event_ts',
        value: effectiveUpdateTime,
        source: 'api',
        priority: 2,
        timestamp: effectiveUpdateTime,
      });

      // CRITICAL FIX: Kickoff timestamps with fallback to current time
      // When API doesn't provide liveKickoffTime, use current time as fallback
      // This ensures minute calculation can proceed even with incomplete API data
      if (Array.isArray(matchData.score) && matchData.score.length >= 2) {
        const statusId = matchData.score[1];

        // Use API kickoff time if available, otherwise use current timestamp as fallback
        const kickoffTime = live.liveKickoffTime !== null ? live.liveKickoffTime : now;

        // First half (status 2): update first_half_kickoff_ts
        if (statusId === 2) {
          updates.push({
            field: 'first_half_kickoff_ts',
            value: kickoffTime,
            source: 'api',
            priority: 2,
            timestamp: live.updateTime || providerUpdateTime || now,
          });
          if (live.liveKickoffTime === null) {
            logger.warn(`[DataUpdate.orchestrator] Using fallback kickoff time (now) for first_half of ${matchId}`);
          }
        }
        // Second half (status 4): update second_half_kickoff_ts
        else if (statusId === 4) {
          updates.push({
            field: 'second_half_kickoff_ts',
            value: kickoffTime,
            source: 'api',
            priority: 2,
            timestamp: live.updateTime || providerUpdateTime || now,
          });
          if (live.liveKickoffTime === null) {
            logger.warn(`[DataUpdate.orchestrator] Using fallback kickoff time (now) for second_half of ${matchId}`);
          }
        }
        // Overtime (status 5+): update overtime_kickoff_ts
        else if (statusId >= 5) {
          updates.push({
            field: 'overtime_kickoff_ts',
            value: kickoffTime,
            source: 'api',
            priority: 2,
            timestamp: live.updateTime || providerUpdateTime || now,
          });
          if (live.liveKickoffTime === null) {
            logger.warn(`[DataUpdate.orchestrator] Using fallback kickoff time (now) for overtime of ${matchId}`);
          }
        }
      }

      // Step 4: Send to orchestrator
      if (updates.length > 0) {
        const result = await this.orchestrator.updateMatch(matchId, updates, 'dataUpdate');

        if (result.status === 'success') {
          logEvent('info', 'dataupdate.orchestrator.success', {
            matchId,
            fieldsUpdated: result.fieldsUpdated,
          });
        } else if (result.status === 'retry') {
          logger.warn(`[DataUpdate.orchestrator] Retry needed for ${matchId}: ${result.reason}`);
        } else {
          logger.warn(`[DataUpdate.orchestrator] Rejected for ${matchId}: ${result.reason}`);
        }

        return; // Return the status_id for post-match processing
      }
    } catch (error: any) {
      logger.error(`[DataUpdate.orchestrator] Error for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Check for updates
   */
  async checkUpdates(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[DataUpdate] Data update check already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    const runId = Math.random().toString(16).slice(2, 8);
    const startedAt = Date.now();
    logEvent('debug', 'dataupdate.tick.start', { run_id: runId });

    try {
      const payload: any = await this.dataUpdateService.checkUpdates();

      if (!payload) {
        logger.debug(`[DataUpdate:${runId}] No payload received`);
        return;
      }

      const keys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
      logger.debug(
        `[DataUpdate:${runId}] checkUpdates() ok; keys=[${keys.slice(0, 12).join(', ')}]`
      );

      const { matchIds: changedMatchIds, updateTimeByMatchId } = this.normalizeChangedMatches(payload);

      if (changedMatchIds.length === 0) {
        logger.debug(
          `[DataUpdate:${runId}] No changed matches. rawChangedType=${Array.isArray(payload) ? 'array' : typeof payload}`
        );
        return;
      }

      logEvent('info', 'dataupdate.changed', {
        count: changedMatchIds.length,
        match_ids: changedMatchIds.slice(0, 10), // First 10 for example
        run_id: runId,
      });

      // CRITICAL FIX: Handle database connection errors gracefully (placeholder DB)
      let dbClient = null;
      try {
        dbClient = await pool.connect();
      } catch (dbError: any) {
        // Database connection failed (placeholder DB or not configured)
        const isDbConnectionError = dbError.message?.includes('getaddrinfo') ||
          dbError.message?.includes('EAI_AGAIN') ||
          dbError.message?.includes('placeholder') ||
          dbError.message?.includes('Connection');

        if (isDbConnectionError) {
          logger.warn(`[DataUpdate:${runId}] Database connection failed (placeholder DB). Skipping DB operations. Error: ${dbError.message}`);
          // Continue without database - don't crash the worker
          return;
        } else {
          // Re-throw non-connection errors
          throw dbError;
        }
      }

      try {
        for (const matchId of changedMatchIds) {
          try {
            const matchIdStr = String(matchId);
            const updateTime = updateTimeByMatchId.get(matchIdStr) ?? null;

            const exists = await dbClient.query(
              'SELECT 1 FROM ts_matches WHERE external_id = $1 LIMIT 1',
              [matchIdStr]
            );

            if (exists.rows.length === 0) {
              logger.warn(
                `[DataUpdate:${runId}] Changed match ${matchIdStr} NOT in DB. Skipping reconcile.`
              );
              continue;
            }

            const t0 = Date.now();
            logEvent('info', 'dataupdate.reconcile.start', {
              match_id: matchIdStr,
              provider_update_time: updateTime !== null ? updateTime : undefined,
              run_id: runId,
            });

            // PHASE C: Use orchestrator for centralized write coordination
            await this.reconcileViaOrchestrator(matchIdStr, updateTime);

            const duration = Date.now() - t0;
            logEvent('info', 'dataupdate.reconcile.done', {
              match_id: matchIdStr,
              duration_ms: duration,
              run_id: runId,
            });

            // PHASE 4+: On match end (status=8), sync final stats/trend to database
            // Check current status from database after orchestrator update
            const statusResult = await dbClient.query(
              'SELECT status_id FROM ts_matches WHERE external_id = $1',
              [matchIdStr]
            );
            const currentStatusId = statusResult.rows[0]?.status_id;

            if (currentStatusId === 8) {
              logger.info(`[DataUpdate:${runId}] Match ${matchIdStr} ended (status=8), syncing final stats/trend...`);
              try {
                // Fetch and save final combined stats (includes incidents)
                const stats = await this.combinedStatsService.getCombinedMatchStats(matchIdStr);
                if (stats && stats.allStats.length > 0) {
                  await this.combinedStatsService.saveCombinedStatsToDatabase(matchIdStr, stats);
                  logger.info(`[DataUpdate:${runId}] Saved ${stats.allStats.length} final stats for ${matchIdStr}`);
                }

                // Fetch and save final trend data
                const trend = await this.matchTrendService.getMatchTrend({ match_id: matchIdStr }, 8);
                const trendResults = trend?.results;
                const hasTrendData = Array.isArray(trendResults) ? trendResults.length > 0 : !!trendResults;
                if (hasTrendData) {
                  // Save trend to statistics JSONB field
                  await dbClient.query(`
                    UPDATE ts_matches 
                    SET statistics = COALESCE(statistics, '{}'::jsonb) || jsonb_build_object('trend', $2::jsonb)
                    WHERE external_id = $1
                  `, [matchIdStr, JSON.stringify(trend)]);
                  logger.info(`[DataUpdate:${runId}] Saved trend data for ${matchIdStr}`);
                }
              } catch (syncErr: any) {
                logger.warn(`[DataUpdate:${runId}] Failed to sync final stats/trend for ${matchIdStr}:`, syncErr.message);
              }
            }
          } catch (err: any) {
            logger.error(`[DataUpdate] Error reconciling changed match ${matchId}:`, err);
          }
        }
      } finally {
        if (dbClient) {
          dbClient.release();
        }
      }
    } catch (error: any) {
      logger.error('Data update check error:', error);
    } finally {
      this.isRunning = false;
      logger.debug(`[DataUpdate:${runId}] Tick end (${Date.now() - startedAt}ms)`);
    }
  }

  /**
   * Start the worker
   * Runs every 20 seconds (as per API documentation: recommended request frequency: 20 seconds/time)
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Data update worker already started');
      return;
    }

    // Run immediately on start
    void this.checkUpdates();

    // Then run every 20 seconds
    this.intervalId = setInterval(() => {
      void this.checkUpdates();
    }, 20000);

    logEvent('info', 'worker.started', {
      worker: 'DataUpdateWorker',
      interval_sec: 20,
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Data update worker stopped');
    }
  }
}
