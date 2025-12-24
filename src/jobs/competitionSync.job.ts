/**
 * Competition Sync Worker
 * 
 * Background job to sync competition/league data from TheSports API
 * Runs daily at 02:00 (after match sync) to avoid rate limits
 */

import * as cron from 'node-cron';
import { LeagueSyncService } from '../services/thesports/competition/leagueSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class CompetitionSyncWorker {
  private leagueSyncService: LeagueSyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.leagueSyncService = new LeagueSyncService();
  }

  /**
   * Sync competitions (smart sync - automatically chooses full or incremental)
   */
  async syncCompetitions(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Competition sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting competition sync job...');
      const result = await this.leagueSyncService.sync();
      logger.info(
        `Competition sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors (${result.isFullUpdate ? 'FULL' : 'INCREMENTAL'})`
      );
    } catch (error: any) {
      logger.error('Competition sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use syncCompetitions() instead
   */
  async syncAllCompetitions(): Promise<void> {
    return this.syncCompetitions();
  }

  /**
   * Start the worker
   * Runs full sync daily at 02:00, incremental sync every 6 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Competition sync worker already started');
      return;
    }

    // Full sync daily at 02:00 (after match sync at 00:00)
    // Note: sync() will automatically do full update if no sync state exists
    cron.schedule('0 2 * * *', async () => {
      await this.syncCompetitions();
    });

    // Incremental sync every 6 hours
    // Note: sync() will automatically do incremental update if sync state exists
    cron.schedule('0 */6 * * *', async () => {
      if (!this.isRunning) {
        await this.syncCompetitions();
      }
    });

    // Run initial sync on start
    this.syncCompetitions();

    logEvent('info', 'worker.started', {
      worker: 'CompetitionSyncWorker',
      schedule: '0 2 * * *, 0 */6 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Competition sync worker stopped');
    }
  }
}

