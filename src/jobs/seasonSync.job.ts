/**
 * Season Sync Worker
 * 
 * Background job to sync season/timeline data from TheSports API
 * Critical for "Standings/Table" and filtering current matches
 */

import * as cron from 'node-cron';
import { SeasonSyncService } from '../services/thesports/season/seasonSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class SeasonSyncWorker {
  private seasonSyncService: SeasonSyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.seasonSyncService = new SeasonSyncService();
  }

  /**
   * Sync all seasons (full sync)
   */
  async syncAllSeasons(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Season sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting season sync job...');
      const result = await this.seasonSyncService.syncAllSeasons();
      logger.info(`Season sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
    } catch (error: any) {
      logger.error('Season sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Full sync daily at 05:00 (after venue sync at 04:30)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Season sync worker already started');
      return;
    }

    // Full sync daily at 05:00 (after venue sync at 04:30)
    cron.schedule('0 5 * * *', async () => {
      await this.syncAllSeasons();
    });

    // Incremental sync every 12 hours
    cron.schedule('0 */12 * * *', async () => {
      if (!this.isRunning) {
        logger.info('Starting incremental season sync...');
        await this.seasonSyncService.syncIncremental();
      }
    });

    // Run initial sync on start
    setTimeout(() => {
      this.syncAllSeasons();
    }, 30000); // 30 second delay after venue sync

    logEvent('info', 'worker.started', {
      worker: 'SeasonSyncWorker',
      schedule: '0 5 * * *, 0 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Season sync worker stopped');
    }
  }
}




