/**
 * Stage Sync Worker
 * 
 * Background job to sync stage/tournament phase data from TheSports API
 * Crucial for distinguishing "Group Stage" vs "Finals"
 */

import * as cron from 'node-cron';
import { StageSyncService } from '../services/thesports/stage/stageSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class StageSyncWorker {
  private stageSyncService: StageSyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.stageSyncService = new StageSyncService();
  }

  /**
   * Sync all stages (full sync)
   */
  async syncAllStages(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Stage sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting stage sync job...');
      const result = await this.stageSyncService.syncAllStages();
      logger.info(`Stage sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
    } catch (error: any) {
      logger.error('Stage sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Full sync daily at 05:30 (after season sync at 05:00)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Stage sync worker already started');
      return;
    }

    // Full sync daily at 05:30 (after season sync at 05:00)
    cron.schedule('30 5 * * *', async () => {
      await this.syncAllStages();
    });

    // Incremental sync every 12 hours
    cron.schedule('30 */12 * * *', async () => {
      if (!this.isRunning) {
        logger.info('Starting incremental stage sync...');
        await this.stageSyncService.syncIncremental();
      }
    });

    // Run initial sync on start
    setTimeout(() => {
      this.syncAllStages();
    }, 35000); // 35 second delay after season sync

    logEvent('info', 'worker.started', {
      worker: 'StageSyncWorker',
      schedule: '30 5 * * *, 30 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Stage sync worker stopped');
    }
  }
}




