/**
 * Player Sync Worker
 * 
 * Background job to sync player data from TheSports API
 * High volume operation - runs less frequently
 * Runs after team sync to ensure FK relationships are available
 */

import * as cron from 'node-cron';
import { PlayerSyncService } from '../services/thesports/player/playerSync.service';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class PlayerSyncWorker {
  private playerSyncService: PlayerSyncService;
  private weeklyCronJob: cron.ScheduledTask | null = null;
  private dailyCronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.playerSyncService = new PlayerSyncService();
  }

  /**
   * Sync players (smart sync - automatically chooses full or incremental)
   * WARNING: Full sync is a high-volume operation and may take hours
   */
  async syncPlayers(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Player sync is already running, skipping this run.');
      return;
    }

    this.isRunning = true;
    try {
      logger.info('Starting player sync job...');
      const result = await this.playerSyncService.sync();
      logger.info(
        `Player sync completed: ${result.synced}/${result.total} synced, ${result.errors} errors (${result.isFullUpdate ? 'FULL' : 'INCREMENTAL'})`
      );
      if (result.isFullUpdate) {
        logger.warn('⚠️  Full player sync completed - this is a high-volume operation');
      }
    } catch (error: any) {
      logger.error('Player sync job error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use syncPlayers() instead
   */
  async syncAllPlayers(): Promise<void> {
    return this.syncPlayers();
  }

  /**
   * Start the worker
   * Full sync weekly on Sunday at 04:00 (after team sync at 03:00)
   * Incremental sync daily at 05:00 (less frequent due to volume)
   * NOTE: Do not trigger full sync immediately on start
   */
  start(): void {
    if (this.weeklyCronJob || this.dailyCronJob) {
      logger.warn('Player sync worker already started');
      return;
    }

    // Full sync weekly on Sunday at 04:00 (after team sync at 03:00)
    // Note: sync() will automatically do full update if no sync state exists
    this.weeklyCronJob = cron.schedule('0 4 * * 0', async () => {
      await this.syncPlayers();
    });

    // Incremental sync daily at 05:00 (less frequent due to volume)
    // Note: sync() will automatically do incremental update if sync state exists
    this.dailyCronJob = cron.schedule('0 5 * * *', async () => {
      // syncPlayers() already has an isRunning guard, keep this lightweight
      await this.syncPlayers();
    });

    // NOTE: Do NOT run initial sync on start (too high volume)
    // User can trigger manually if needed
    logEvent('info', 'worker.started', {
      worker: 'PlayerSyncWorker',
      schedules: {
        weekly_full: '0 4 * * 0',
        daily_incremental: '0 5 * * *',
      },
      note: 'Full sync is high-volume and only runs on weekly schedule; daily run is incremental when sync state exists.',
    });
    logger.warn('⚠️  Player sync is high volume - full sync will NOT run automatically on startup');
  }

  /**
   * Stop the worker
   */
  stop(): void {
    let stoppedAny = false;

    if (this.weeklyCronJob) {
      this.weeklyCronJob.stop();
      this.weeklyCronJob = null;
      stoppedAny = true;
    }

    if (this.dailyCronJob) {
      this.dailyCronJob.stop();
      this.dailyCronJob = null;
      stoppedAny = true;
    }

    if (stoppedAny) {
      logger.info('Player sync worker stopped');
    }
  }
}
