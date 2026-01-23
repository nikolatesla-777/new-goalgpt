"use strict";
/**
 * Team Data Sync Worker
 *
 * Background job to sync incomplete team data (missing name or logo)
 * Runs every 6 hours
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamDataSyncWorker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const TheSportsAPIManager_1 = require("../core/TheSportsAPIManager"); // Phase 3A: Singleton migration
const teamData_service_1 = require("../services/thesports/team/teamData.service");
const TeamRepository_1 = require("../repositories/implementations/TeamRepository");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class TeamDataSyncWorker {
    constructor() {
        this.cronJob = null;
        this.client = TheSportsAPIManager_1.theSportsAPI; // Phase 3A: Use singleton
        this.teamDataService = new teamData_service_1.TeamDataService();
        this.teamRepository = new TeamRepository_1.TeamRepository();
    }
    /**
     * Sync incomplete teams
     */
    async syncIncompleteTeams() {
        try {
            logger_1.logger.info('Starting team data sync job...');
            const incompleteTeams = await this.teamRepository.findIncomplete(100);
            logger_1.logger.info(`Found ${incompleteTeams.length} incomplete teams to sync`);
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
                        logger_1.logger.debug(`Synced team: ${team.external_id}`);
                    }
                }
                catch (error) {
                    failed++;
                    logger_1.logger.error(`Failed to sync team ${team.external_id}:`, error.message);
                }
            }
            logger_1.logger.info(`Team data sync completed: ${synced} synced, ${failed} failed`);
        }
        catch (error) {
            logger_1.logger.error('Team data sync job error:', error);
        }
    }
    /**
     * Start the worker
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Team data sync worker already started');
            return;
        }
        // Run every 6 hours
        this.cronJob = node_cron_1.default.schedule('0 */6 * * *', async () => {
            await this.syncIncompleteTeams();
        });
        // Run immediately on start
        this.syncIncompleteTeams();
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'TeamDataSyncWorker',
            schedule: '0 */6 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Team data sync worker stopped');
        }
    }
}
exports.TeamDataSyncWorker = TeamDataSyncWorker;
