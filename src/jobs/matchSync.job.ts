/**
 * Match Sync Worker
 * 
 * Background job to sync matches using incremental sync
 * Uses /match/recent/list with time parameter
 * Runs every 1 minute
 */

import cron from 'node-cron';
import { theSportsAPI } from '../core/TheSportsAPIManager'; // Phase 3A: Singleton migration
import { RecentSyncService } from '../services/thesports/match/recentSync.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { logger } from '../utils/logger';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { pool } from '../database/connection';
import { logEvent } from '../utils/obsLogger';
import { AIPredictionService } from '../services/ai/aiPrediction.service';
import { predictionSettlementService } from '../services/ai/predictionSettlement.service';
import { LiveMatchOrchestrator, FieldUpdate } from '../services/orchestration/LiveMatchOrchestrator';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MatchSyncWorker {
  private recentSyncService: RecentSyncService;
  private matchDetailLiveService: MatchDetailLiveService;
  private orchestrator: LiveMatchOrchestrator;
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private liveInterval: NodeJS.Timeout | null = null;
  private firstHalfInterval: NodeJS.Timeout | null = null;
  private secondHalfInterval: NodeJS.Timeout | null = null;
  private halfTimeInterval: NodeJS.Timeout | null = null;

  // LIVE reconcile queue (dedup) + backpressure controls
  private reconcileQueue = new Set<string>();
  private isReconciling = false;
  private liveTickInterval: NodeJS.Timeout | null = null;
  private predictionResultInterval: NodeJS.Timeout | null = null;
  private aiPredictionService: AIPredictionService;

  // Reconcile backpressure constants
  private readonly RECONCILE_BATCH_LIMIT = 15;
  private readonly RECONCILE_DELAY_MS = 50; // fast updates (50ms per API call)

  // TheSports status buckets (adjust if your enums differ)
  // LIVE phases: first/second half, halftime, overtime, penalties
  private readonly LIVE_STATUS_IDS = [2, 3, 4, 5, 7];
  // HALF_TIME is special: minute should not "run", but status/score can still change.
  private readonly HALFTIME_STATUS_IDS = [3];
  // SECOND_HALF matches need more frequent checks for END transition (FT detection)
  private readonly SECOND_HALF_STATUS_IDS = [4];
  // FIRST_HALF matches need frequent checks for HALF_TIME transition (status 2 → 3)
  private readonly FIRST_HALF_STATUS_IDS = [2];
  private client = theSportsAPI; // Phase 3A: Use singleton

  constructor() {
    // Initialize MatchSyncService for RecentSyncService
    const teamDataService = new TeamDataService();
    const competitionService = new CompetitionService();
    const matchSyncService = new MatchSyncService(teamDataService, competitionService);

    this.recentSyncService = new RecentSyncService(matchSyncService);
    this.matchDetailLiveService = new MatchDetailLiveService();
    this.aiPredictionService = new AIPredictionService();
    this.orchestrator = LiveMatchOrchestrator.getInstance();
  }

  /**
   * Sync matches incrementally using /match/recent/list with time parameter
   */
  async syncMatches(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Match sync job skipped: previous run still in progress');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting match incremental sync job...');

      const result = await this.recentSyncService.syncIncremental();

      logger.info(`Match sync completed: ${result.synced} matches synced, ${result.errors} errors`);

      // After incremental sync, run authoritative reconciliation for LIVE matches.
      await this.reconcileLiveMatches();
    } catch (error: any) {
      logger.error('Match sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Enqueue a match for authoritative detail_live reconciliation (dedup).
   * Safe to call frequently; Set dedups.
   */
  public enqueueReconcile(matchId: string): void {
    if (!matchId) return;
    this.reconcileQueue.add(String(matchId));
  }

  /**
   * Enqueue matches by status bucket for authoritative reconciliation.
   * This does NOT call the API directly; it only fills the queue.
   */
  private async enqueueMatchesForReconcile(statusIds: number[], label: string, limit = 500): Promise<void> {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `
        SELECT external_id
        FROM ts_matches
        WHERE status_id = ANY($1)
        ORDER BY match_time ASC
        LIMIT $2
        `,
        [statusIds, limit]
      );

      if (res.rows.length === 0) {
        logger.debug(`[${label}] No matches found.`);
        return;
      }

      for (const row of res.rows) {
        this.enqueueReconcile(String(row.external_id));
      }

      logger.info(`[${label}] Enqueued ${res.rows.length} matches for reconciliation.`);
    } finally {
      client.release();
    }
  }

  private async reconcileLiveMatches(): Promise<void> {
    await this.enqueueMatchesForReconcile(this.LIVE_STATUS_IDS, 'LiveReconcile', 500);
  }

  /**
   * PHASE C: Reconcile match via LiveMatchOrchestrator
   *
   * Fetches match detail_live from API and sends updates to orchestrator
   * for centralized write coordination.
   */
  private async reconcileViaOrchestrator(matchId: string): Promise<void> {
    try {
      // Step 1: Fetch match detail_live from API
      const resp = await this.matchDetailLiveService.getMatchDetailLive(
        { match_id: matchId },
        { forceRefresh: true }
      );

      // Step 2: Extract fields from response
      const results = (resp as any).results || (resp as any).result_list;
      if (!results || !Array.isArray(results)) {
        logger.warn(`[reconcileViaOrchestrator] No results for match ${matchId}`);
        return;
      }

      const matchData = results.find((m: any) => String(m?.id || m?.match_id) === String(matchId));
      if (!matchData) {
        logger.warn(`[reconcileViaOrchestrator] Match ${matchId} not found in results`);
        return;
      }

      // Step 3: Parse fields
      const updates: FieldUpdate[] = [];
      const now = Math.floor(Date.now() / 1000);

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
            timestamp: matchData.update_time || now,
          });
        }

        if (awayScoreDisplay !== null) {
          updates.push({
            field: 'away_score_display',
            value: awayScoreDisplay,
            source: 'api',
            priority: 2,
            timestamp: matchData.update_time || now,
          });
        }

        if (statusId !== null && statusId !== undefined) {
          updates.push({
            field: 'status_id',
            value: statusId,
            source: 'api',
            priority: 2,
            timestamp: matchData.update_time || now,
          });
        }
      }
      // REMOVED: API minute - calculated by MatchMinuteWorker per TheSports formula

      // Provider timestamps
      if (matchData.update_time) {
        updates.push({
          field: 'provider_update_time',
          value: matchData.update_time,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time,
        });
      }

      if (matchData.event_time) {
        updates.push({
          field: 'last_event_ts',
          value: matchData.event_time,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time || now,
        });
      }

      // Second half kickoff (write-once)
      if (matchData.second_half_kickoff_ts) {
        updates.push({
          field: 'second_half_kickoff_ts',
          value: matchData.second_half_kickoff_ts,
          source: 'api',
          priority: 2,
          timestamp: matchData.update_time || now,
        });
      }

      // Step 4: Send to orchestrator
      if (updates.length > 0) {
        const result = await this.orchestrator.updateMatch(matchId, updates, 'matchSync');

        if (result.status === 'success') {
          logEvent('info', 'matchsync.orchestrator.success', {
            matchId,
            fieldsUpdated: result.fieldsUpdated,
          });
        } else if (result.status === 'retry') {
          // Retry later
          this.enqueueReconcile(matchId);
        }
      }
    } catch (error: any) {
      logger.error(`[reconcileViaOrchestrator] Error for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Process the reconcile queue with backpressure + throttling.
   * - Dedup via Set
   * - Max N matches per tick
   * - Throttle between API calls
   */
  private async processReconcileQueue(): Promise<void> {
    if (this.isReconciling) return;
    if (this.reconcileQueue.size === 0) return;

    this.isReconciling = true;
    try {
      const toProcess: string[] = [];
      for (const id of this.reconcileQueue) {
        toProcess.push(id);
        if (toProcess.length >= this.RECONCILE_BATCH_LIMIT) break;
      }

      // Remove selected IDs before processing
      for (const id of toProcess) this.reconcileQueue.delete(id);

      logger.info(
        `[LiveReconcile] Processing ${toProcess.length} matches (queueRemaining=${this.reconcileQueue.size})`
      );

      for (const matchId of toProcess) {
        try {
          // PHASE C: Use orchestrator for centralized write coordination
          await this.reconcileViaOrchestrator(String(matchId));
        } catch (err: any) {
          logger.error(`[LiveReconcile] Error reconciling matchId=${matchId}:`, err);
        }
        await sleep(this.RECONCILE_DELAY_MS);
      }

      logger.info('[LiveReconcile] Queue batch processed.');
    } finally {
      this.isReconciling = false;
    }
  }
  /**
   * Start the worker
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Match sync worker already started');
      return;
    }

    // Run every 1 minute (CRITICAL: Changed from 5 minutes for real-time updates)
    this.cronJob = cron.schedule('*/1 * * * *', async () => {
      await this.syncMatches();
    });

    // Tier-1 reconcile: enqueue LIVE-phase matches every 3 seconds for REAL-TIME updates
    this.liveInterval = setInterval(() => {
      this.reconcileLiveMatches().catch(err => logger.error('[LiveReconcile] enqueue interval error:', err));
    }, 3000);

    // Tier-1.5 reconcile: enqueue FIRST_HALF matches every 20 seconds (for HALF_TIME transition detection)
    // CRITICAL: First half matches can transition to HALF_TIME (status 2 → 3) at any time around 45 minutes
    this.firstHalfInterval = setInterval(() => {
      this.enqueueMatchesForReconcile(this.FIRST_HALF_STATUS_IDS, 'FirstHalfReconcile', 500)
        .catch(err => logger.error('[FirstHalfReconcile] enqueue interval error:', err));
    }, 20000); // Every 20 seconds for HALF_TIME transition detection

    // Tier-1.6 reconcile: enqueue SECOND_HALF matches every 15 seconds (more frequent for END/FT detection)
    // CRITICAL: Second half matches can finish at any time, need frequent checks for status 8 (END)
    this.secondHalfInterval = setInterval(() => {
      this.enqueueMatchesForReconcile(this.SECOND_HALF_STATUS_IDS, 'SecondHalfReconcile', 500)
        .catch(err => logger.error('[SecondHalfReconcile] enqueue interval error:', err));
    }, 15000); // Every 15 seconds for faster END detection

    // Tier-2 reconcile: enqueue HALF_TIME matches every 30 seconds (status can change to SECOND_HALF)
    // CRITICAL: HALF_TIME matches can transition to SECOND_HALF (status 3 → 4) quickly
    this.halfTimeInterval = setInterval(() => {
      this.enqueueMatchesForReconcile(this.HALFTIME_STATUS_IDS, 'HalfTimeReconcile', 500)
        .catch(err => logger.error('[HalfTimeReconcile] enqueue interval error:', err));
    }, 30000); // Every 30 seconds (reduced from 120s for faster SECOND_HALF transition)

    // Process reconcile queue every 1 second (backpressure-controlled)
    this.liveTickInterval = setInterval(() => {
      this.processReconcileQueue().catch(err => logger.error('[LiveReconcile] process interval error:', err));
    }, 1000);

    // Prediction Resulter: Update prediction results every 30 seconds
    // Checks matched predictions where match has ended and calculates win/lose
    // Uses centralized PredictionSettlementService for proper IY/MS differentiation
    this.predictionResultInterval = setInterval(async () => {
      try {
        // ============================================
        // PART 1: HALFTIME & FULLTIME SETTLEMENT
        // For status=3 (halftime) and status=8 (ended)
        // ============================================
        const pendingResult = await pool.query(`
          SELECT DISTINCT
            p.match_id,
            m.status_id,
            m.home_score_display,
            m.away_score_display,
            (m.home_scores->0)::INTEGER as current_home_score,
            (m.away_scores->0)::INTEGER as current_away_score,
            (m.home_scores->1)::INTEGER as ht_home_score,
            (m.away_scores->1)::INTEGER as ht_away_score
          FROM ai_predictions p
          JOIN ts_matches m ON p.match_id = m.external_id
          WHERE p.result = 'pending'
            AND p.match_id IS NOT NULL
            AND (m.status_id = 8 OR m.status_id = 3)
        `);

        let totalSettled = 0;
        for (const row of pendingResult.rows) {
          const eventType = row.status_id === 3 ? 'halftime' : 'fulltime';
          const homeScore = eventType === 'halftime'
            ? (parseInt(row.ht_home_score) || 0)
            : (parseInt(row.home_score_display) || parseInt(row.current_home_score) || 0);
          const awayScore = eventType === 'halftime'
            ? (parseInt(row.ht_away_score) || 0)
            : (parseInt(row.away_score_display) || parseInt(row.current_away_score) || 0);

          const result = await predictionSettlementService.processEvent({
            matchId: row.match_id,
            eventType,
            homeScore,
            awayScore,
            htHome: parseInt(row.ht_home_score) || undefined,
            htAway: parseInt(row.ht_away_score) || undefined,
            statusId: row.status_id,
            timestamp: Date.now(),
          });

          totalSettled += result.settled;
        }

        if (totalSettled > 0) {
          logger.info(`[PredictionResulter] Settled ${totalSettled} prediction results (HT/FT)`);
        }

        // ============================================
        // PART 2: LIVE MATCH INSTANT WIN SETTLEMENT
        // CRITICAL FIX: For status=2,4 (live matches)
        // This catches matches where WebSocket/MQTT doesn't send score updates
        // ============================================
        const liveResult = await pool.query(`
          SELECT DISTINCT
            p.match_id,
            m.status_id,
            m.minute,
            (m.home_scores->0)::INTEGER as current_home_score,
            (m.away_scores->0)::INTEGER as current_away_score
          FROM ai_predictions p
          JOIN ts_matches m ON p.match_id = m.external_id
          WHERE p.result = 'pending'
            AND p.match_id IS NOT NULL
            AND m.status_id IN (2, 4, 5, 7)
        `);

        let liveSettled = 0;
        for (const row of liveResult.rows) {
          const homeScore = parseInt(row.current_home_score) || 0;
          const awayScore = parseInt(row.current_away_score) || 0;
          const totalGoals = homeScore + awayScore;

          // Only process if there are goals (instant win is only possible with goals)
          if (totalGoals > 0) {
            // Use proxy minute based on status for IY/MS determination
            // Status 2 = 1st half, Status 4+ = 2nd half
            const proxyMinute = row.status_id === 2 ? (row.minute || 1) : (row.minute || 46);

            const result = await predictionSettlementService.processEvent({
              matchId: row.match_id,
              eventType: 'score_change',
              homeScore,
              awayScore,
              minute: proxyMinute,
              statusId: row.status_id,
              timestamp: Date.now(),
            });

            if (result.settled > 0) {
              liveSettled += result.settled;
              logger.info(`[PredictionResulter] LIVE instant win for ${row.match_id}: ${homeScore}-${awayScore}, settled ${result.settled}`);
            }
          }
        }

        if (liveSettled > 0) {
          logger.info(`[PredictionResulter] Settled ${liveSettled} LIVE instant win predictions`);
        }
      } catch (err) {
        logger.error('[PredictionResulter] Error updating prediction results:', err);
      }
    }, 30000); // Every 30 seconds

    // Run immediately on start (but wait 10 seconds to let bootstrap complete)
    setTimeout(() => {
      this.syncMatches();
    }, 10000);

    logEvent('info', 'worker.started', {
      worker: 'MatchSyncWorker',
      schedule: '*/1 * * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Match sync worker stopped');
    }
    if (this.liveInterval) {
      clearInterval(this.liveInterval);
      this.liveInterval = null;
      logger.info('Live reconcile interval stopped');
    }

    if (this.secondHalfInterval) {
      clearInterval(this.secondHalfInterval);
      this.secondHalfInterval = null;
      logger.info('Second half reconcile interval stopped');
    }

    if (this.liveTickInterval) {
      clearInterval(this.liveTickInterval);
      this.liveTickInterval = null;
      logger.info('Live reconcile queue processor stopped');
    }

    if (this.halfTimeInterval) {
      clearInterval(this.halfTimeInterval);
      this.halfTimeInterval = null;
      logger.info('Half-time reconcile interval stopped');
    }

    if (this.predictionResultInterval) {
      clearInterval(this.predictionResultInterval);
      this.predictionResultInterval = null;
      logger.info('Prediction result interval stopped');
    }
  }
}
