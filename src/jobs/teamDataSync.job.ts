/**
 * Team Data Sync Worker
 * 
 * Background job to sync incomplete team data (missing name or logo)
 * Runs every 6 hours
 */

import cron from 'node-cron';
import { theSportsAPI } from '../core/TheSportsAPIManager'; // Phase 3A: Singleton migration
import { TeamDataService } from '../services/thesports/team/teamData.service';
import { TeamRepository } from '../repositories/implementations/TeamRepository';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class TeamDataSyncWorker {
  private teamDataService: TeamDataService;
  private teamRepository: TeamRepository;
  private cronJob: cron.ScheduledTask | null = null;
  private client = theSportsAPI; // Phase 3A: Use singleton

  constructor() {
    this.teamDataService = new TeamDataService();
    this.teamRepository = new TeamRepository();
  }

  /**
   * Sync incomplete teams
   */
  async syncIncompleteTeams(): Promise<void> {
    try {
      logger.info('Starting team data sync job...');

      const incompleteTeams = await this.teamRepository.findIncomplete(100);
      logger.info(`Found ${incompleteTeams.length} incomplete teams to sync`);

      let synced = 0;
      let failed = 0;

      for (const team of incompleteTeams) {
        try {
          // Try to fetch team data
          const teamData = await this.teamDataService.getTeamById(team.external_id);
          
          if (teamData) {
            await this.teamRepository.update(team.id, {
              name: teamData.name || team.name,
              short_name: teamData.short_name || team.short_name,
              logo_url: teamData.logo_url || team.logo_url,
            });
            synced++;
            logger.debug(`Synced team: ${team.external_id}`);
          }
        } catch (error: any) {
          failed++;
          logger.error(`Failed to sync team ${team.external_id}:`, error.message);
        }
      }

      logger.info(`Team data sync completed: ${synced} synced, ${failed} failed`);
    } catch (error: any) {
      logger.error('Team data sync job error:', error);
    }
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Team data sync worker already started');
      return;
    }

    // Run every 6 hours
    this.cronJob = cron.schedule('0 */6 * * *', async () => {
      await this.syncIncompleteTeams();
    });

    // Run immediately on start
    this.syncIncompleteTeams();

    logEvent('info', 'worker.started', {
      worker: 'TeamDataSyncWorker',
      schedule: '0 */6 * * *',
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Team data sync worker stopped');
    }
  }
}

