/**
 * Coach Sync Worker
 * 
 * Background job to sync coach/manager data from TheSports API
 * Runs after team sync to ensure FK relationships are available
 */

import * as cron from 'node-cron';
import { CoachSyncService } from '../services/thesports/coach/coachSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class CoachSyncWorker {
  private coachSyncService: CoachSyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.coachSyncService = new CoachSyncService();
  }

  /**
   * Sync coaches (smart sync - automatically chooses full or incremental)
   */
  async syncCoaches(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Coach sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting coach sync job...');
      const result = await this.coachSyncService.sync();
      logger.info(
        `Coach sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors (${result.isFullUpdate ? 'FULL' : 'INCREMENTAL'})`
      );
    } catch (error: any) {
      logger.error('Coach sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use syncCoaches() instead
   */
  async syncAllCoaches(): Promise<void> {
    return this.syncCoaches();
  }

  /**
   * Start the worker
   * Full sync daily at 03:30 (after team sync at 03:00)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Coach sync worker already started');
      return;
    }

    // Full sync daily at 03:30 (after team sync at 03:00)
    // Note: sync() will automatically do full update if no sync state exists
    cron.schedule('30 3 * * *', async () => {
      await this.syncCoaches();
    });

    // Incremental sync every 12 hours
    // Note: sync() will automatically do incremental update if sync state exists
    cron.schedule('30 */12 * * *', async () => {
      if (!this.isRunning) {
        await this.syncCoaches();
      }
    });

    // Run initial sync on start (with delay to ensure teams are synced first)
    setTimeout(() => {
      this.syncCoaches();
    }, 15000); // 15 second delay after team sync

    logEvent('info', 'worker.started', {
      worker: 'CoachSyncWorker',
      schedule: '30 3 * * *, 30 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Coach sync worker stopped');
    }
  }
}

