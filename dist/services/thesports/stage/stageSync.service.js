"use strict";
/**
 * Stage Sync Service
 *
 * Fetches stage/tournament phase data from TheSports API and stores in database
 * Uses /stage/list endpoint with pagination
 * Crucial for distinguishing "Group Stage" vs "Finals"
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageSyncService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../config");
const logger_1 = require("../../../utils/logger");
const StageRepository_1 = require("../../../repositories/implementations/StageRepository");
class StageSyncService {
    constructor() {
        this.repository = new StageRepository_1.StageRepository();
        this.baseUrl = config_1.config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
        this.user = config_1.config.thesports?.user || '';
        this.secret = config_1.config.thesports?.secret || '';
    }
    /**
     * Fetch all stages from TheSports API
     * Uses pagination to get all results
     * Endpoint: GET /stage/list
     */
    async syncAllStages() {
        logger_1.logger.info('Starting stage sync from TheSports API...');
        let page = 1;
        let hasMore = true;
        let totalFetched = 0;
        let totalSynced = 0;
        let totalErrors = 0;
        while (hasMore) {
            try {
                logger_1.logger.info(`Fetching stages page ${page}...`);
                const response = await axios_1.default.get(`${this.baseUrl}/stage/list`, {
                    params: {
                        user: this.user,
                        secret: this.secret,
                        page,
                    },
                    timeout: 30000,
                });
                const data = response.data;
                // Check for errors
                if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
                    const errorMsg = data.err || data.msg || 'Unknown error';
                    logger_1.logger.warn(`TheSports API error on page ${page}: ${errorMsg}`);
                    // If rate limited, wait and retry
                    if (data.code === 429 || errorMsg.toLowerCase().includes('too many requests')) {
                        logger_1.logger.warn('Rate limit hit, waiting 60 seconds...');
                        await new Promise(resolve => setTimeout(resolve, 60000));
                        continue; // Retry same page
                    }
                    totalErrors++;
                    page++;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before next page
                    continue;
                }
                const stages = data.results || [];
                totalFetched += stages.length;
                // CRITICAL: Break when results array is empty (as per API docs)
                if (stages.length === 0) {
                    hasMore = false;
                    break;
                }
                // Transform and save to database
                const stagesToSave = stages.map(stage => ({
                    external_id: stage.id,
                    season_id: stage.season_id || null,
                    name: stage.name || 'Unknown Stage',
                    mode: stage.mode || null,
                    group_count: stage.group_count || null,
                    round_count: stage.round_count || null,
                    sort_order: stage.sort_order || null,
                    updated_at: stage.updated_at,
                }));
                try {
                    const saved = await this.repository.batchUpsert(stagesToSave);
                    totalSynced += saved.length;
                    logger_1.logger.info(`Synced ${saved.length} stages from page ${page}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to save stages from page ${page}:`, error.message);
                    totalErrors++;
                }
                // Move to next page
                page++;
                // Rate limit safety: wait 200ms between pages to avoid 429
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            catch (error) {
                logger_1.logger.error(`Error fetching stages page ${page}:`, error.message);
                totalErrors++;
                // If rate limited, wait longer
                if (error.response?.status === 429 || error.message?.includes('429')) {
                    logger_1.logger.warn('Rate limit hit, waiting 60 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                }
                else {
                    page++;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        logger_1.logger.info(`Stage sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
        return {
            total: totalFetched,
            synced: totalSynced,
            errors: totalErrors,
        };
    }
    /**
     * Sync stages incrementally (only new/updated since last sync)
     * Note: The /stage/list endpoint doesn't support time parameter,
     * so incremental sync will fetch all and update only changed records
     */
    async syncIncremental(lastSyncTime) {
        logger_1.logger.info('Starting incremental stage sync...');
        // Since /stage/list doesn't support time parameter,
        // we'll do a full sync but the upsert will only update changed records
        const result = await this.syncAllStages();
        return { total: result.total, synced: result.synced };
    }
}
exports.StageSyncService = StageSyncService;
