/**
 * Match Data Sync Worker
 * 
 * Background job to automatically save match data (statistics, incidents, trend) for live matches
 * Runs every 60 seconds to ensure data is persisted even if no user visits the match detail page
 * 
 * CRITICAL: This prevents data loss when users visit match details the next day
 */

import { theSportsAPI } from '../core/TheSportsAPIManager'; // Phase 3A: Singleton migration
import { CombinedStatsService } from '../services/thesports/match/combinedStats.service';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { MatchTrendService } from '../services/thesports/match/matchTrend.service';
import { MatchDatabaseService } from '../services/thesports/match/matchDatabase.service';
import { AIPredictionService } from '../services/ai/aiPrediction.service';
import { predictionSettlementService } from '../services/ai/predictionSettlement.service';
import { pool } from '../database/connection';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';
import { broadcastEvent } from '../routes/websocket.routes';
import { jobRunner } from './framework/JobRunner';
import { LOCK_KEYS } from './lockKeys';
import { matchOrchestrator } from '../modules/matches/services/MatchOrchestrator';
import { FieldUpdate } from '../repositories/match.repository';
import { LIVE_STATUSES_SQL } from '../types/thesports/enums/MatchState.enum';

// PR-8B: Using MatchOrchestrator for atomic match updates

export class MatchDataSyncWorker {
  private apiClient = theSportsAPI; // Phase 3A: Use singleton
  private combinedStatsService: CombinedStatsService;
  private matchDetailLiveService: MatchDetailLiveService;
  private matchTrendService: MatchTrendService;
  private matchDatabaseService: MatchDatabaseService;
  private aiPredictionService: AIPredictionService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.combinedStatsService = new CombinedStatsService();
    this.matchDetailLiveService = new MatchDetailLiveService();
    this.matchTrendService = new MatchTrendService();
    this.matchDatabaseService = new MatchDatabaseService();
    this.aiPredictionService = new AIPredictionService();
  }

  /**
   * PR-8B: Orchestrator wrapper for match updates
   * Replaces direct SQL UPDATE with matchOrchestrator.updateMatch()
   */
  private async updateMatchDirect(matchId: string, updates: FieldUpdate[], source: string): Promise<{ status: string; fieldsUpdated: string[] }> {
    if (updates.length === 0) {
      return { status: 'success', fieldsUpdated: [] };
    }

    try {
      // PR-8B: Use MatchOrchestrator for atomic updates with:
      // - Match-level advisory lock
      // - Priority-based conflict resolution
      // - Immutability protection (status=8)
      const orchestratorResult = await matchOrchestrator.updateMatch(matchId, updates, source);

      // Map orchestrator result to expected format (with undefined safety)
      const result = {
        status: orchestratorResult.status,
        fieldsUpdated: orchestratorResult.fieldsUpdated ?? [],
      };

      // If update failed (locked, rejected, etc), return early
      if (orchestratorResult.status !== 'success') {
        if (orchestratorResult.status === 'rejected_immutable') {
          logger.warn(`[MatchDataSync.orchestrator] REJECT: Match ${matchId} is immutable (status=8)`);
        } else if (orchestratorResult.status === 'rejected_locked') {
          logger.debug(`[MatchDataSync.orchestrator] Lock busy for match ${matchId}, skipping update`);
        } else if (orchestratorResult.status === 'rejected_stale') {
          logger.debug(`[MatchDataSync.orchestrator] Updates rejected by priority filter for ${matchId}`);
        } else if (orchestratorResult.status === 'rejected_invalid') {
          // PR-8B.1: Invalid matchId (alphanumeric hash collision or malformed ID)
          logger.debug(`[MatchDataSync.orchestrator] Skipped ${matchId}: invalid matchId`);
        }
        return result;
      }

      // Success - get actual fieldsUpdated from orchestrator
      const fieldsUpdated = orchestratorResult.fieldsUpdated ?? [];

      // CRITICAL FIX: Broadcast WebSocket events after database write
      // This ensures frontend receives real-time updates
      const hasScoreUpdate = fieldsUpdated.some(f => f === 'home_score_display' || f === 'away_score_display');
      const hasStatusUpdate = fieldsUpdated.some(f => f === 'status_id');
      const hasMinuteUpdate = fieldsUpdated.some(f => f === 'minute');

      try {
        if (hasScoreUpdate || hasStatusUpdate) {
          const homeScoreUpdate = updates.find(u => u.field === 'home_score_display');
          const awayScoreUpdate = updates.find(u => u.field === 'away_score_display');
          const statusUpdate = updates.find(u => u.field === 'status_id');

          if (hasScoreUpdate) {
            broadcastEvent({
              type: 'SCORE_CHANGE',
              matchId,
              homeScore: homeScoreUpdate?.value,
              awayScore: awayScoreUpdate?.value,
              statusId: statusUpdate?.value,
              timestamp: Date.now(),
            } as any);
          }

          if (hasStatusUpdate) {
            broadcastEvent({
              type: 'MATCH_STATE_CHANGE',
              matchId,
              statusId: statusUpdate?.value,
              newStatus: statusUpdate?.value,
              timestamp: Date.now(),
            } as any);
          }
        }

        if (hasMinuteUpdate) {
          const minuteUpdate = updates.find(u => u.field === 'minute');
          const statusUpdate = updates.find(u => u.field === 'status_id');

          broadcastEvent({
            type: 'MINUTE_UPDATE',
            matchId,
            minute: minuteUpdate?.value,
            statusId: statusUpdate?.value || 2,
            timestamp: Date.now(),
          } as any);
        }
      } catch (broadcastError: any) {
        logger.warn(`[MatchDataSync.orchestrator] Failed to broadcast event for ${matchId}: ${broadcastError.message}`);
      }

      return result;
    } catch (error: any) {
      logger.error(`[MatchDataSync.orchestrator] Failed to update ${matchId}:`, error);
      return { status: 'error', fieldsUpdated: [] };
    }
  }

  /**
   * Get all live matches from database
   * Status IDs: 2=FIRST_HALF, 3=HALF_TIME, 4=SECOND_HALF, 5=OVERTIME, 7=PENALTY_SHOOTOUT
   */
  private async getLiveMatchesFromDatabase(): Promise<Array<{ external_id: string; match_time: number }>> {
    const client = await pool.connect();
    try {
      const now = Math.floor(Date.now() / 1000);
      const fourHoursAgo = now - (4 * 60 * 60); // 4 hours ago
      
      const result = await client.query(`
        SELECT external_id, match_time
        FROM ts_matches
        WHERE status_id IN (${LIVE_STATUSES_SQL})
          AND match_time >= $1
          AND match_time <= $2
        ORDER BY match_time DESC
        LIMIT 100
      `, [fourHoursAgo, now]);

      return result.rows;
    } catch (error: any) {
      logger.error('[MatchDataSync] Error getting live matches from database:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Save statistics for a match
   */
  private async saveMatchStatistics(matchId: string): Promise<boolean> {
    try {
      const stats = await this.combinedStatsService.getCombinedMatchStats(matchId);
      if (stats && stats.allStats.length > 0) {
        await this.combinedStatsService.saveCombinedStatsToDatabase(matchId, stats);
        logger.debug(`[MatchDataSync] Saved statistics for ${matchId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      logger.warn(`[MatchDataSync] Failed to save statistics for ${matchId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Save incidents for a match
   */
  private async saveMatchIncidents(matchId: string): Promise<boolean> {
    try {
      const detailLive = await this.matchDetailLiveService.getMatchDetailLive({ match_id: matchId });
      if (detailLive?.results && Array.isArray(detailLive.results)) {
        const matchData: any = detailLive.results.find((r: any) => r.id === matchId) || detailLive.results[0];
        if (matchData?.incidents && Array.isArray(matchData.incidents) && matchData.incidents.length > 0) {
          // Get existing stats and merge with incidents
          const existingStats = await this.combinedStatsService.getCombinedStatsFromDatabase(matchId);
          if (existingStats) {
            existingStats.incidents = matchData.incidents;
            existingStats.score = matchData.score || existingStats.score;
            await this.combinedStatsService.saveCombinedStatsToDatabase(matchId, existingStats);
            logger.debug(`[MatchDataSync] Saved incidents for ${matchId}`);
            return true;
          } else {
            // Create new entry with incidents
            const newStats = {
              matchId: matchId,
              basicStats: [],
              detailedStats: [],
              allStats: [],
              incidents: matchData.incidents,
              score: matchData.score || null,
              lastUpdated: Date.now(),
            };
            await this.combinedStatsService.saveCombinedStatsToDatabase(matchId, newStats);
            logger.debug(`[MatchDataSync] Saved incidents (new entry) for ${matchId}`);
            return true;
          }
        }
      }
      return false;
    } catch (error: any) {
      logger.warn(`[MatchDataSync] Failed to save incidents for ${matchId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Save trend data for a match
   */
  private async saveMatchTrend(matchId: string): Promise<boolean> {
    try {
      // Get match status to determine which endpoint to use
      const client = await pool.connect();
      let matchStatus = 0;
      try {
        const statusResult = await client.query(`
          SELECT status_id FROM ts_matches WHERE external_id = $1
        `, [matchId]);
        matchStatus = statusResult.rows[0]?.status_id || 0;
      } finally {
        client.release();
      }

      // For live matches, use getMatchTrend which automatically chooses live or detail endpoint
      const trendData = await this.matchTrendService.getMatchTrend({ match_id: matchId }, matchStatus);

      if (trendData?.results) {
        // Check if results is array or object
        const results = Array.isArray(trendData.results) ? trendData.results[0] : trendData.results;

        // Check if results has actual data
        if (results && typeof results === 'object' && !Array.isArray(results)) {
          if ((results.first_half?.length ?? 0) > 0 || (results.second_half?.length ?? 0) > 0 || (results.overtime?.length ?? 0) > 0) {
            // PR-8B: trend_data field not in MatchUpdateFields schema
            // Trend data caching to database removed (available via API on demand)
            logger.debug(`[MatchDataSync] Fetched trend data for ${matchId} (not cached to DB)`);
            return false; // Not saved to DB, but data is available
          }
        }
      }
      return false;
    } catch (error: any) {
      logger.warn(`[MatchDataSync] Failed to save trend for ${matchId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Sync data for a single match
   */
  private async syncMatchData(matchId: string): Promise<{
    stats: boolean;
    incidents: boolean;
    trend: boolean;
    settlement: boolean;
  }> {
    const result = {
      stats: false,
      incidents: false,
      trend: false,
      settlement: false,
    };

    try {
      // Save statistics
      result.stats = await this.saveMatchStatistics(matchId);

      // Save incidents
      result.incidents = await this.saveMatchIncidents(matchId);

      // Save trend
      result.trend = await this.saveMatchTrend(matchId);

      // CRITICAL: Check and settle pending predictions for this match
      // This ensures predictions are settled even if WebSocket events are missed
      try {
        const client = await pool.connect();
        try {
          const matchQuery = await client.query(`
            SELECT status_id, home_score_display, away_score_display, minute
            FROM ts_matches
            WHERE external_id = $1
          `, [matchId]);

          if (matchQuery.rows.length > 0) {
            const match = matchQuery.rows[0];
            const homeScore = parseInt(match.home_score_display) || 0;
            const awayScore = parseInt(match.away_score_display) || 0;
            const minute = match.minute || 0;
            const statusId = match.status_id;

            // Trigger settlement check using centralized PredictionSettlementService
            // Determine event type based on status
            const eventType = statusId === 3 ? 'halftime' : statusId === 8 ? 'fulltime' : 'score_change';

            const settlementResult = await predictionSettlementService.processEvent({
              matchId,
              eventType,
              homeScore,
              awayScore,
              minute,
              statusId,
              timestamp: Date.now(),
            });

            result.settlement = settlementResult.settled > 0;
            if (settlementResult.settled > 0) {
              logger.info(`[MatchDataSync] Settlement for ${matchId}: ${settlementResult.settled} settled (${settlementResult.winners}W/${settlementResult.losers}L)`);
            } else {
              logger.debug(`[MatchDataSync] Settlement check completed for ${matchId} (no pending predictions)`);
            }
          }
        } finally {
          client.release();
        }
      } catch (settlementError: any) {
        // Don't fail the entire sync if settlement fails
        logger.warn(`[MatchDataSync] Settlement check failed for ${matchId}: ${settlementError.message}`);
      }

      return result;
    } catch (error: any) {
      logger.error(`[MatchDataSync] Error syncing data for ${matchId}:`, error);
      return result;
    }
  }

  /**
   * Sync data for all live matches
   *
   * PR-8A: Wrapped with JobRunner for overlap guard + timeout + metrics
   */
  private async syncAllLiveMatches(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[MatchDataSync] Sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // PR-8A: Wrap execution with JobRunner (no SQL logic changes)
      await jobRunner.run(
        {
          jobName: 'matchDataSync',
          overlapGuard: true,
          advisoryLockKey: LOCK_KEYS.MATCH_DATA_SYNC,
          timeoutMs: 300000, // 5 minutes
        },
        async (_ctx) => {
          // Original syncAllLiveMatches() logic unchanged below this line
      logger.info('[MatchDataSync] Starting sync for all live matches...');
      
      const liveMatches = await this.getLiveMatchesFromDatabase();
      logger.info(`[MatchDataSync] Found ${liveMatches.length} live matches to sync`);

      if (liveMatches.length === 0) {
        logger.debug('[MatchDataSync] No live matches to sync');
        return;
      }

      let statsCount = 0;
      let incidentsCount = 0;
      let trendCount = 0;
      let settlementCount = 0;
      let errorCount = 0;

      // Process matches sequentially to avoid overwhelming the API
      for (const match of liveMatches) {
        try {
          const result = await this.syncMatchData(match.external_id);
          
          if (result.stats) statsCount++;
          if (result.incidents) incidentsCount++;
          if (result.trend) trendCount++;
          if (result.settlement) settlementCount++;

          // Small delay between matches to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error: any) {
          errorCount++;
          logger.error(`[MatchDataSync] Error processing match ${match.external_id}:`, error);
        }
      }

      const duration = Date.now() - startTime;
      logger.info(
        `[MatchDataSync] ✅ Sync completed in ${duration}ms: ` +
        `stats=${statsCount}, incidents=${incidentsCount}, trend=${trendCount}, settlement=${settlementCount}, errors=${errorCount}`
      );

      logEvent('info', 'match_data_sync.completed', {
        matches_processed: liveMatches.length,
        stats_saved: statsCount,
        incidents_saved: incidentsCount,
        trend_saved: trendCount,
        settlement_checked: settlementCount,
        errors: errorCount,
        duration_ms: duration,
      });
        } // PR-8A: End jobRunner.run() wrapper
      ); // PR-8A: Close jobRunner.run()
    } catch (error: any) {
      logger.error('[MatchDataSync] Error in syncAllLiveMatches:', error);
      logEvent('error', 'match_data_sync.failed', {
        error: error.message,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Runs every 60 seconds to sync data for all live matches
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('[MatchDataSync] Worker already started');
      return;
    }

    logger.info('[MatchDataSync] Starting Match Data Sync Worker (runs every 60 seconds)');

    // Run immediately on start (with small delay to let server initialize)
    setTimeout(() => {
      this.syncAllLiveMatches().catch(err => {
        logger.error('[MatchDataSync] Error in initial sync:', err);
      });
    }, 10000); // 10 second delay

    // Then run every 60 seconds
    this.intervalId = setInterval(() => {
      this.syncAllLiveMatches().catch(err => {
        logger.error('[MatchDataSync] Error in periodic sync:', err);
      });
    }, 60000); // 60 seconds

    logEvent('info', 'worker.started', {
      worker: 'MatchDataSyncWorker',
      interval_seconds: 60,
      note: 'Automatically saves statistics, incidents, and trend data for all live matches',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[MatchDataSync] Worker stopped');
      logEvent('info', 'worker.stopped', {
        worker: 'MatchDataSyncWorker',
      });
    }
  }
}

