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
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';


export class DataUpdateWorker {
  private dataUpdateService: DataUpdateService;
  private apiClient: TheSportsClient;
  private matchDetailLiveService: MatchDetailLiveService;
  private combinedStatsService: CombinedStatsService;
  private matchTrendService: MatchTrendService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.dataUpdateService = new DataUpdateService();
    this.apiClient = new TheSportsClient();
    this.matchDetailLiveService = new MatchDetailLiveService(this.apiClient);
    this.combinedStatsService = new CombinedStatsService(this.apiClient);
    this.matchTrendService = new MatchTrendService(this.apiClient);
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

            const result = await this.matchDetailLiveService.reconcileMatchToDatabase(
              matchIdStr,
              updateTime !== null ? updateTime : null
            );

            const duration = Date.now() - t0;
            logEvent('info', 'dataupdate.reconcile.done', {
              match_id: matchIdStr,
              duration_ms: duration,
              rowCount: result.rowCount,
              run_id: runId,
            });

            // CRITICAL FIX: On match end (status=8), trigger comprehensive post-match persistence
            // This ensures ALL match data (stats, incidents, trend, player stats, standings) is saved
            if (result.statusId === 8) {
              logger.info(`[DataUpdate:${runId}] Match ${matchIdStr} ended (status=8), triggering post-match persistence...`);
              try {
                // Use PostMatchProcessor for comprehensive data persistence
                const { PostMatchProcessor } = await import('../services/liveData/postMatchProcessor');
                const processor = new PostMatchProcessor(this.client);
                
                // Trigger comprehensive post-match processing
                await processor.onMatchEnded(matchIdStr);
                logger.info(`[DataUpdate:${runId}] ✅ Post-match persistence completed for ${matchIdStr}`);
              } catch (syncErr: any) {
                logger.warn(`[DataUpdate:${runId}] Failed to trigger post-match persistence for ${matchIdStr}:`, syncErr.message);
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
