/**
 * Match Sync Worker
 * 
 * Background job to sync matches using incremental sync
 * Uses /match/recent/list with time parameter
 * Runs every 1 minute
 */

import cron from 'node-cron';
import { TheSportsClient } from '../services/thesports/client/thesports-client';
import { RecentSyncService } from '../services/thesports/match/recentSync.service';
import { MatchSyncService } from '../services/thesports/match/matchSync.service';
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { CompetitionService } from '../services/thesports/competition/competition.service';
import { logger } from '../utils/logger';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { pool } from '../database/connection';
import { logEvent } from '../utils/obsLogger';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class MatchSyncWorker {
  private recentSyncService: RecentSyncService;
  private matchDetailLiveService: MatchDetailLiveService;
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private liveInterval: NodeJS.Timeout | null = null;
  private secondHalfInterval: NodeJS.Timeout | null = null;
  private halfTimeInterval: NodeJS.Timeout | null = null;

  // LIVE reconcile queue (dedup) + backpressure controls
  private reconcileQueue = new Set<string>();
  private isReconciling = false;
  private liveTickInterval: NodeJS.Timeout | null = null;

  // Reconcile backpressure constants
  private readonly RECONCILE_BATCH_LIMIT = 25;
  private readonly RECONCILE_DELAY_MS = 200; // per API call delay

  // TheSports status buckets (adjust if your enums differ)
  // LIVE phases: first/second half, overtime, etc.
  private readonly LIVE_STATUS_IDS = [2, 4, 5];
  // HALF_TIME is special: minute should not "run", but status/score can still change.
  private readonly HALFTIME_STATUS_IDS = [3];
  // SECOND_HALF matches need more frequent checks for END transition (FT detection)
  private readonly SECOND_HALF_STATUS_IDS = [4];

  constructor(client: TheSportsClient) {
    // Initialize MatchSyncService for RecentSyncService
    const teamDataService = new TeamDataService(client);
    const competitionService = new CompetitionService(client);
    const matchSyncService = new MatchSyncService(teamDataService, competitionService);
    
    this.recentSyncService = new RecentSyncService(client, matchSyncService);
    this.matchDetailLiveService = new MatchDetailLiveService(client);
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
          await this.matchDetailLiveService.reconcileMatchToDatabase(String(matchId));
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

    // Tier-1 reconcile: enqueue LIVE-phase matches every 30 seconds
    this.liveInterval = setInterval(() => {
      this.reconcileLiveMatches().catch(err => logger.error('[LiveReconcile] enqueue interval error:', err));
    }, 30000);

    // Tier-1.5 reconcile: enqueue SECOND_HALF matches every 15 seconds (more frequent for END/FT detection)
    // CRITICAL: Second half matches can finish at any time, need frequent checks for status 8 (END)
    this.secondHalfInterval = setInterval(() => {
      this.enqueueMatchesForReconcile(this.SECOND_HALF_STATUS_IDS, 'SecondHalfReconcile', 500)
        .catch(err => logger.error('[SecondHalfReconcile] enqueue interval error:', err));
    }, 15000); // Every 15 seconds for faster END detection

    // Tier-2 reconcile: enqueue HALF_TIME matches less frequently (status can change, but minute must not "run")
    this.halfTimeInterval = setInterval(() => {
      this.enqueueMatchesForReconcile(this.HALFTIME_STATUS_IDS, 'HalfTimeReconcile', 500)
        .catch(err => logger.error('[HalfTimeReconcile] enqueue interval error:', err));
    }, 120000);

    // Process reconcile queue every 1 second (backpressure-controlled)
    this.liveTickInterval = setInterval(() => {
      this.processReconcileQueue().catch(err => logger.error('[LiveReconcile] process interval error:', err));
    }, 1000);

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
  }
}
