/**
 * Category Sync Worker
 * 
 * Background job to sync category (country/region) data from TheSports API
 * STATUS: Skeleton - waiting for API documentation
 */

import * as cron from 'node-cron';
import { CategorySyncService } from '../services/thesports/category/categorySync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class CategorySyncWorker {
  private categorySyncService: CategorySyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.categorySyncService = new CategorySyncService();
  }

  /**
   * Sync all categories (full sync)
   */
  async syncAllCategories(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Category sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting category sync job...');
      const result = await this.categorySyncService.syncAllCategories();
      logger.info(`Category sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
    } catch (error: any) {
      logger.error('Category sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Full sync daily at 01:00 (before competition sync at 02:00)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Category sync worker already started');
      return;
    }

    // Full sync daily at 01:00 (before competition sync)
    cron.schedule('0 1 * * *', async () => {
      await this.syncAllCategories();
    });

    // Incremental sync every 12 hours
    cron.schedule('0 */12 * * *', async () => {
      if (!this.isRunning) {
        logger.info('Starting incremental category sync...');
        await this.categorySyncService.syncIncremental();
      }
    });

    // Run initial sync on start
    this.syncAllCategories();

    logEvent('info', 'worker.started', {
      worker: 'CategorySyncWorker',
      schedule: '0 1 * * *, 0 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Category sync worker stopped');
    }
  }
}

