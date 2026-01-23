"use strict";
/**
 * Category Sync Service
 *
 * Fetches category (country/region) data from TheSports API and stores in database
 * STATUS: Skeleton - waiting for API documentation to define endpoint and response structure
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategorySyncService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../config");
const logger_1 = require("../../../utils/logger");
const CategoryRepository_1 = require("../../../repositories/implementations/CategoryRepository");
class CategorySyncService {
    constructor() {
        this.repository = new CategoryRepository_1.CategoryRepository();
        this.baseUrl = config_1.config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
        this.user = config_1.config.thesports?.user || '';
        this.secret = config_1.config.thesports?.secret || '';
    }
    /**
     * Fetch all categories from TheSports API
     * Endpoint: GET /category/list
     */
    async syncAllCategories() {
        logger_1.logger.info('Starting category sync from TheSports API...');
        let totalFetched = 0;
        let totalSynced = 0;
        let totalErrors = 0;
        try {
            logger_1.logger.info('Fetching categories from /category/list...');
            const response = await axios_1.default.get(`${this.baseUrl}/category/list`, {
                params: {
                    user: this.user,
                    secret: this.secret,
                },
                timeout: 30000,
            });
            const data = response.data;
            // Check for errors
            if (data.err || (data.code && data.code !== 200 && data.code !== 0)) {
                const errorMsg = data.err || data.msg || 'Unknown error';
                logger_1.logger.warn(`TheSports API error: ${errorMsg}`);
                // If rate limited, wait and retry
                if (data.code === 429 || errorMsg.toLowerCase().includes('too many requests')) {
                    logger_1.logger.warn('Rate limit hit, waiting 60 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                    // Retry once
                    return this.syncAllCategories();
                }
                return {
                    total: 0,
                    synced: 0,
                    errors: 1,
                };
            }
            const categories = data.results || [];
            totalFetched = categories.length;
            if (categories.length === 0) {
                logger_1.logger.warn('No categories returned from API');
                return {
                    total: 0,
                    synced: 0,
                    errors: 0,
                };
            }
            // Transform and save to database
            const categoriesToSave = categories.map(cat => ({
                external_id: cat.id,
                name: cat.name,
                updated_at: cat.updated_at,
            }));
            try {
                const saved = await this.repository.batchUpsert(categoriesToSave);
                totalSynced = saved.length;
                logger_1.logger.info(`Synced ${saved.length} categories to database`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to save categories:`, error.message);
                totalErrors = categories.length;
            }
        }
        catch (error) {
            logger_1.logger.error(`Error fetching categories:`, error.message);
            // If rate limited, wait and retry
            if (error.response?.status === 429 || error.message?.includes('429')) {
                logger_1.logger.warn('Rate limit hit, waiting 60 seconds...');
                await new Promise(resolve => setTimeout(resolve, 60000));
                // Retry once
                return this.syncAllCategories();
            }
            totalErrors = 1;
        }
        logger_1.logger.info(`Category sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
        return {
            total: totalFetched,
            synced: totalSynced,
            errors: totalErrors,
        };
    }
    /**
     * Sync categories incrementally (only new/updated since last sync)
     * Note: The /category/list endpoint doesn't support time parameter,
     * so incremental sync will fetch all and update only changed records
     */
    async syncIncremental(lastSyncTime) {
        logger_1.logger.info('Starting incremental category sync...');
        // Since /category/list doesn't support time parameter,
        // we'll do a full sync but the upsert will only update changed records
        const result = await this.syncAllCategories();
        return { total: result.total, synced: result.synced };
    }
}
exports.CategorySyncService = CategorySyncService;
