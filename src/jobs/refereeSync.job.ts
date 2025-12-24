/**
 * Referee Sync Worker
 * 
 * Background job to sync referee/official data from TheSports API
 * Critical for future "Card/Penalty" AI predictions
 */

import * as cron from 'node-cron';
import { RefereeSyncService } from '../services/thesports/referee/refereeSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class RefereeSyncWorker {
  private refereeSyncService: RefereeSyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.refereeSyncService = new RefereeSyncService();
  }

  /**
   * Sync all referees (full sync)
   */
  async syncAllReferees(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Referee sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting referee sync job...');
      const result = await this.refereeSyncService.syncAllReferees();
      logger.info(`Referee sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
    } catch (error: any) {
      logger.error('Referee sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Full sync daily at 04:00 (after coach sync at 03:30)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Referee sync worker already started');
      return;
    }

    // Full sync daily at 04:00 (after coach sync at 03:30)
    cron.schedule('0 4 * * *', async () => {
      await this.syncAllReferees();
    });

    // Incremental sync every 12 hours
    cron.schedule('0 */12 * * *', async () => {
      if (!this.isRunning) {
        logger.info('Starting incremental referee sync...');
        await this.refereeSyncService.syncIncremental();
      }
    });

    // Run initial sync on start
    setTimeout(() => {
      this.syncAllReferees();
    }, 20000); // 20 second delay after coach sync

    logEvent('info', 'worker.started', {
      worker: 'RefereeSyncWorker',
      schedule: '0 4 * * *, 0 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Referee sync worker stopped');
    }
  }
}




