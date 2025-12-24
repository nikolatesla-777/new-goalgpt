/**
 * Venue Sync Worker
 * 
 * Background job to sync venue/stadium data from TheSports API
 * Critical for "Home Advantage" analysis and future Weather integration
 */

import * as cron from 'node-cron';
import { VenueSyncService } from '../services/thesports/venue/venueSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class VenueSyncWorker {
  private venueSyncService: VenueSyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.venueSyncService = new VenueSyncService();
  }

  /**
   * Sync all venues (full sync)
   */
  async syncAllVenues(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Venue sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting venue sync job...');
      const result = await this.venueSyncService.syncAllVenues();
      logger.info(`Venue sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
    } catch (error: any) {
      logger.error('Venue sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Full sync daily at 04:30 (after referee sync at 04:00)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Venue sync worker already started');
      return;
    }

    // Full sync daily at 04:30 (after referee sync at 04:00)
    cron.schedule('30 4 * * *', async () => {
      await this.syncAllVenues();
    });

    // Incremental sync every 12 hours
    cron.schedule('30 */12 * * *', async () => {
      if (!this.isRunning) {
        logger.info('Starting incremental venue sync...');
        await this.venueSyncService.syncIncremental();
      }
    });

    // Run initial sync on start
    setTimeout(() => {
      this.syncAllVenues();
    }, 25000); // 25 second delay after referee sync

    logEvent('info', 'worker.started', {
      worker: 'VenueSyncWorker',
      schedule: '30 4 * * *, 30 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Venue sync worker stopped');
    }
  }
}




