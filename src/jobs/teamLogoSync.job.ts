/**
 * Team Logo Sync Worker
 * 
 * Background job to sync missing team logos
 * Runs every 12 hours
 */

import cron from 'node-cron';
import { theSportsAPI } from '../core/TheSportsAPIManager'; // Phase 3A: Singleton migration
import { TeamLogoService } from '../services/thesports/team/teamLogo.service';
import { TeamRepository } from '../repositories/implementations/TeamRepository';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class TeamLogoSyncWorker {
  private teamLogoService: TeamLogoService;
  private teamRepository: TeamRepository;
  private cronJob: cron.ScheduledTask | null = null;
  private client = theSportsAPI; // Phase 3A: Use singleton

  constructor() {
    this.teamLogoService = new TeamLogoService(this.client);
    this.teamRepository = new TeamRepository();
  }

  /**
   * Sync missing logos
   */
  async syncMissingLogos(): Promise<void> {
    try {
      logger.info('Starting team logo sync job...');

      const teamsWithoutLogo = await this.teamRepository.findWithoutLogo(100);
      logger.info(`Found ${teamsWithoutLogo.length} teams without logo to sync`);

      let synced = 0;
      let failed = 0;

      for (const team of teamsWithoutLogo) {
        try {
          const logoUrl = await this.teamLogoService.getTeamLogoUrl(team.external_id);
          
          if (logoUrl) {
            await this.teamRepository.update(team.id, { logo_url: logoUrl });
            synced++;
            logger.debug(`Synced logo for team: ${team.external_id}`);
          }
        } catch (error: any) {
          failed++;
          logger.error(`Failed to sync logo for team ${team.external_id}:`, error.message);
        }
      }

      logger.info(`Team logo sync completed: ${synced} synced, ${failed} failed`);
    } catch (error: any) {
      logger.error('Team logo sync job error:', error);
    }
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Team logo sync worker already started');
      return;
    }

    // Run every 12 hours
    this.cronJob = cron.schedule('0 */12 * * *', async () => {
      await this.syncMissingLogos();
    });

    // Run immediately on start
    this.syncMissingLogos();

    logEvent('info', 'worker.started', {
      worker: 'TeamLogoSyncWorker',
      schedule: '0 */12 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Team logo sync worker stopped');
    }
  }
}

