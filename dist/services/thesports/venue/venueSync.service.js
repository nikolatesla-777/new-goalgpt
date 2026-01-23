"use strict";
/**
 * Venue Sync Service
 *
 * Fetches venue/stadium data from TheSports API and stores in database
 * Uses /venue/list endpoint with pagination
 * Critical for "Home Advantage" analysis and future Weather integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VenueSyncService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../config");
const logger_1 = require("../../../utils/logger");
const VenueRepository_1 = require("../../../repositories/implementations/VenueRepository");
class VenueSyncService {
    constructor() {
        this.repository = new VenueRepository_1.VenueRepository();
        this.baseUrl = config_1.config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
        this.user = config_1.config.thesports?.user || '';
        this.secret = config_1.config.thesports?.secret || '';
    }
    /**
     * Fetch all venues from TheSports API
     * Uses pagination to get all results
     * Endpoint: GET /venue/list
     */
    async syncAllVenues() {
        logger_1.logger.info('Starting venue sync from TheSports API...');
        let page = 1;
        let hasMore = true;
        let totalFetched = 0;
        let totalSynced = 0;
        let totalErrors = 0;
        while (hasMore) {
            try {
                logger_1.logger.info(`Fetching venues page ${page}...`);
                const response = await axios_1.default.get(`${this.baseUrl}/venue/list`, {
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
                const venues = data.results || [];
                totalFetched += venues.length;
                // CRITICAL: Break when results array is empty (as per API docs)
                if (venues.length === 0) {
                    hasMore = false;
                    break;
                }
                // Transform and save to database
                const venuesToSave = venues.map(venue => ({
                    external_id: venue.id,
                    name: venue.name || 'Unknown Venue',
                    city: venue.city || null,
                    capacity: venue.capacity || null,
                    country_id: venue.country_id || null,
                    updated_at: venue.updated_at,
                }));
                try {
                    const saved = await this.repository.batchUpsert(venuesToSave);
                    totalSynced += saved.length;
                    logger_1.logger.info(`Synced ${saved.length} venues from page ${page}`);
                }
                catch (error) {
                    logger_1.logger.error(`Failed to save venues from page ${page}:`, error.message);
                    totalErrors++;
                }
                // Move to next page
                page++;
                // Rate limit safety: wait 200ms between pages to avoid 429
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            catch (error) {
                logger_1.logger.error(`Error fetching venues page ${page}:`, error.message);
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
        logger_1.logger.info(`Venue sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
        return {
            total: totalFetched,
            synced: totalSynced,
            errors: totalErrors,
        };
    }
    /**
     * Sync venues incrementally (only new/updated since last sync)
     * Note: The /venue/list endpoint doesn't support time parameter,
     * so incremental sync will fetch all and update only changed records
     */
    async syncIncremental(lastSyncTime) {
        logger_1.logger.info('Starting incremental venue sync...');
        // Since /venue/list doesn't support time parameter,
        // we'll do a full sync but the upsert will only update changed records
        const result = await this.syncAllVenues();
        return { total: result.total, synced: result.synced };
    }
}
exports.VenueSyncService = VenueSyncService;
