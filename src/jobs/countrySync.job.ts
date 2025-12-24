/**
 * Country Sync Worker
 * 
 * Background job to sync country/region data from TheSports API
 * Runs after category sync to ensure FK relationships are available
 */

import * as cron from 'node-cron';
import { CountrySyncService } from '../services/thesports/country/countrySync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class CountrySyncWorker {
  private countrySyncService: CountrySyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.countrySyncService = new CountrySyncService();
  }

  /**
   * Sync all countries (full sync)
   */
  async syncAllCountries(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Country sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting country sync job...');
      const result = await this.countrySyncService.syncAllCountries();
      logger.info(`Country sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors`);
    } catch (error: any) {
      logger.error('Country sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Full sync daily at 01:30 (after category sync at 01:00)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Country sync worker already started');
      return;
    }

    // Full sync daily at 01:30 (after category sync at 01:00)
    cron.schedule('30 1 * * *', async () => {
      await this.syncAllCountries();
    });

    // Incremental sync every 12 hours
    cron.schedule('30 */12 * * *', async () => {
      if (!this.isRunning) {
        logger.info('Starting incremental country sync...');
        await this.countrySyncService.syncIncremental();
      }
    });

    // Run initial sync on start (with delay to ensure categories are synced first)
    setTimeout(() => {
      this.syncAllCountries();
    }, 5000); // 5 second delay after category sync

    logEvent('info', 'worker.started', {
      worker: 'CountrySyncWorker',
      schedule: '30 1 * * *, 30 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Country sync worker stopped');
    }
  }
}




