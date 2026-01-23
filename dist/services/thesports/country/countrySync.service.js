"use strict";
/**
 * Country Sync Service
 *
 * Fetches country/region data from TheSports API and stores in database
 * Uses /country/list endpoint
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountrySyncService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../../config");
const logger_1 = require("../../../utils/logger");
const CountryRepository_1 = require("../../../repositories/implementations/CountryRepository");
class CountrySyncService {
    constructor() {
        this.repository = new CountryRepository_1.CountryRepository();
        this.baseUrl = config_1.config.thesports?.baseUrl || 'https://api.thesports.com/v1/football';
        this.user = config_1.config.thesports?.user || '';
        this.secret = config_1.config.thesports?.secret || '';
    }
    /**
     * Fetch all countries from TheSports API
     * Endpoint: GET /country/list
     * Note: Ensure categories are synced first to avoid FK issues
     */
    async syncAllCountries() {
        logger_1.logger.info('Starting country sync from TheSports API...');
        let totalFetched = 0;
        let totalSynced = 0;
        let totalErrors = 0;
        try {
            logger_1.logger.info('Fetching countries from /country/list...');
            const response = await axios_1.default.get(`${this.baseUrl}/country/list`, {
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
                    return this.syncAllCountries();
                }
                return {
                    total: 0,
                    synced: 0,
                    errors: 1,
                };
            }
            const countries = data.results || [];
            totalFetched = countries.length;
            if (countries.length === 0) {
                logger_1.logger.warn('No countries returned from API');
                return {
                    total: 0,
                    synced: 0,
                    errors: 0,
                };
            }
            // Transform and save to database
            const countriesToSave = countries.map(country => ({
                external_id: country.id,
                category_id: country.category_id || undefined,
                name: country.name,
                logo: country.logo || undefined,
                updated_at: country.updated_at,
            }));
            try {
                const saved = await this.repository.batchUpsert(countriesToSave);
                totalSynced = saved.length;
                logger_1.logger.info(`Synced ${saved.length} countries to database`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to save countries:`, error.message);
                totalErrors = countries.length;
            }
        }
        catch (error) {
            logger_1.logger.error(`Error fetching countries:`, error.message);
            // If rate limited, wait and retry
            if (error.response?.status === 429 || error.message?.includes('429')) {
                logger_1.logger.warn('Rate limit hit, waiting 60 seconds...');
                await new Promise(resolve => setTimeout(resolve, 60000));
                // Retry once
                return this.syncAllCountries();
            }
            totalErrors = 1;
        }
        logger_1.logger.info(`Country sync completed: ${totalFetched} fetched, ${totalSynced} synced, ${totalErrors} errors`);
        return {
            total: totalFetched,
            synced: totalSynced,
            errors: totalErrors,
        };
    }
    /**
     * Sync countries incrementally (only new/updated since last sync)
     * Note: The /country/list endpoint doesn't support time parameter,
     * so incremental sync will fetch all and update only changed records
     */
    async syncIncremental(lastSyncTime) {
        logger_1.logger.info('Starting incremental country sync...');
        // Since /country/list doesn't support time parameter,
        // we'll do a full sync but the upsert will only update changed records
        const result = await this.syncAllCountries();
        return { total: result.total, synced: result.synced };
    }
}
exports.CountrySyncService = CountrySyncService;
