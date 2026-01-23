"use strict";
/**
 * Team Logo Sync Worker
 *
 * Background job to sync missing team logos
 * Runs every 12 hours
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamLogoSyncWorker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const TheSportsAPIManager_1 = require("../core/TheSportsAPIManager"); // Phase 3A: Singleton migration
const teamLogo_service_1 = require("../services/thesports/team/teamLogo.service");
const TeamRepository_1 = require("../repositories/implementations/TeamRepository");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
class TeamLogoSyncWorker {
    constructor() {
        this.cronJob = null;
        this.client = TheSportsAPIManager_1.theSportsAPI; // Phase 3A: Use singleton
        this.teamLogoService = new teamLogo_service_1.TeamLogoService();
        this.teamRepository = new TeamRepository_1.TeamRepository();
    }
    /**
     * Sync missing logos
     */
    async syncMissingLogos() {
        try {
            logger_1.logger.info('Starting team logo sync job...');
            const teamsWithoutLogo = await this.teamRepository.findWithoutLogo(100);
            logger_1.logger.info(`Found ${teamsWithoutLogo.length} teams without logo to sync`);
            let synced = 0;
            let failed = 0;
            for (const team of teamsWithoutLogo) {
                try {
                    const logoUrl = await this.teamLogoService.getTeamLogoUrl(team.external_id);
                    if (logoUrl) {
                        await this.teamRepository.update(team.id, { logo_url: logoUrl });
                        synced++;
                        logger_1.logger.debug(`Synced logo for team: ${team.external_id}`);
                    }
                }
                catch (error) {
                    failed++;
                    logger_1.logger.error(`Failed to sync logo for team ${team.external_id}:`, error.message);
                }
            }
            logger_1.logger.info(`Team logo sync completed: ${synced} synced, ${failed} failed`);
        }
        catch (error) {
            logger_1.logger.error('Team logo sync job error:', error);
        }
    }
    /**
     * Start the worker
     */
    start() {
        if (this.cronJob) {
            logger_1.logger.warn('Team logo sync worker already started');
            return;
        }
        // Run every 12 hours
        this.cronJob = node_cron_1.default.schedule('0 */12 * * *', async () => {
            await this.syncMissingLogos();
        });
        // Run immediately on start
        this.syncMissingLogos();
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'TeamLogoSyncWorker',
            schedule: '0 */12 * * *',
        });
    }
    /**
     * Stop the worker
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            logger_1.logger.info('Team logo sync worker stopped');
        }
    }
}
exports.TeamLogoSyncWorker = TeamLogoSyncWorker;
