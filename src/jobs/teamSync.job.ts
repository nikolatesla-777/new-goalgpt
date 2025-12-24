/**
 * Team Sync Worker
 * 
 * Background job to sync team/club data from TheSports API
 * Runs after competition sync to ensure FK relationships are available
 */

import * as cron from 'node-cron';
import { TeamSyncService } from '../services/thesports/team/teamSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class TeamSyncWorker {
  private teamSyncService: TeamSyncService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.teamSyncService = new TeamSyncService();
  }

  /**
   * Sync teams (smart sync - automatically chooses full or incremental)
   */
  async syncTeams(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Team sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting team sync job...');
      const result = await this.teamSyncService.sync();
      logger.info(
        `Team sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors (${result.isFullUpdate ? 'FULL' : 'INCREMENTAL'})`
      );
    } catch (error: any) {
      logger.error('Team sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use syncTeams() instead
   */
  async syncAllTeams(): Promise<void> {
    return this.syncTeams();
  }

  /**
   * Start the worker
   * Full sync daily at 03:00 (after competition sync at 02:00)
   * Incremental sync every 12 hours
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Team sync worker already started');
      return;
    }

    // Full sync daily at 03:00 (after competition sync at 02:00)
    // Note: sync() will automatically do full update if no sync state exists
    cron.schedule('0 3 * * *', async () => {
      await this.syncTeams();
    });

    // Incremental sync every 12 hours
    // Note: sync() will automatically do incremental update if sync state exists
    cron.schedule('0 */12 * * *', async () => {
      if (!this.isRunning) {
        await this.syncTeams();
      }
    });

    // Run initial sync on start (with delay to ensure competitions are synced first)
    setTimeout(() => {
      this.syncTeams();
    }, 10000); // 10 second delay after competition sync

    logEvent('info', 'worker.started', {
      worker: 'TeamSyncWorker',
      schedule: '0 3 * * *, 0 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Team sync worker stopped');
    }
  }
}

