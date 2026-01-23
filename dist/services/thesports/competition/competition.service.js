"use strict";
/**
 * Competition Service
 *
 * Handles competition data retrieval
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetitionService = void 0;
// PR-5B: Migrated to hardened TheSportsClient via adapter
const thesports_1 = require("../../../integrations/thesports");
const cache_service_1 = require("../../../utils/cache/cache.service");
const types_1 = require("../../../utils/cache/types");
const logger_1 = require("../../../utils/logger");
const CompetitionRepository_1 = require("../../../repositories/implementations/CompetitionRepository");
class CompetitionService {
    constructor() {
        this.client = thesports_1.theSportsAPIAdapter;
        this.repository = new CompetitionRepository_1.CompetitionRepository();
    }
    /**
     * Get competition list
     */
    async getCompetitionList() {
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:competition:list`;
        // Check cache
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            logger_1.logger.debug('Cache hit for competition list');
            return cached;
        }
        try {
            logger_1.logger.info('Fetching competition list from API');
            const response = await this.client.get('/competition/list');
            if (response.err) {
                logger_1.logger.warn(`TheSports API error for competition list: ${response.err}`);
                return { results: [], err: response.err };
            }
            // Cache response
            await cache_service_1.cacheService.set(cacheKey, response, types_1.CacheTTL.Day);
            return response;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch competition list:', error);
            return { results: [], err: error.message };
        }
    }
    /**
     * Get competition by ID (from database first, fallback to API)
     */
    async getCompetitionById(competitionId) {
        // 1. Check cache
        const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:competition:${competitionId}`;
        const cached = await cache_service_1.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        // 2. Check database
        const dbCompetition = await this.repository.findByExternalId(competitionId);
        if (dbCompetition) {
            const competition = {
                id: dbCompetition.external_id,
                name: dbCompetition.name,
                short_name: dbCompetition.short_name || null,
                logo_url: dbCompetition.logo_url || null,
                type: dbCompetition.type || null,
                category_id: dbCompetition.category_id || null,
                country_id: dbCompetition.country_id || null,
                country_name: dbCompetition.country_name || undefined, // From ts_countries JOIN
                cur_season_id: dbCompetition.cur_season_id || null,
                cur_stage_id: dbCompetition.cur_stage_id || null,
                primary_color: dbCompetition.primary_color || null,
                secondary_color: dbCompetition.secondary_color || null,
            };
            await cache_service_1.cacheService.set(cacheKey, competition, types_1.CacheTTL.Day);
            return competition;
        }
        // 3. Fallback to API (should rarely happen if sync is working)
        logger_1.logger.debug(`Competition ${competitionId} not in DB, fetching from API`);
        try {
            const list = await this.getCompetitionList();
            if (list && list.results && Array.isArray(list.results)) {
                const apiCompetition = list.results.find(c => c && c.id === competitionId);
                if (apiCompetition) {
                    await cache_service_1.cacheService.set(cacheKey, apiCompetition, types_1.CacheTTL.Day);
                    return apiCompetition;
                }
            }
        }
        catch (error) {
            logger_1.logger.warn(`Failed to fetch competition ${competitionId} from API: ${error.message}`);
        }
        return null;
    }
    /**
     * Get competitions by IDs (batch) - from database first
     */
    async getCompetitionsByIds(competitionIds) {
        const map = new Map();
        if (competitionIds.length === 0)
            return map;
        // 1. Check cache for all
        const cachePromises = competitionIds.map(async (id) => {
            const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:competition:${id}`;
            const cached = await cache_service_1.cacheService.get(cacheKey);
            if (cached) {
                map.set(id, cached);
            }
            return { id, cached };
        });
        await Promise.all(cachePromises);
        // 2. Check database for missing
        const missingIds = competitionIds.filter(id => !map.has(id));
        if (missingIds.length > 0) {
            const dbCompetitions = await this.repository.findByExternalIds(missingIds);
            for (const dbComp of dbCompetitions) {
                const competition = {
                    id: dbComp.external_id,
                    name: dbComp.name,
                    short_name: dbComp.short_name || null,
                    logo_url: dbComp.logo_url || null,
                    type: dbComp.type || null,
                    category_id: dbComp.category_id || null,
                    country_id: dbComp.country_id || null,
                    country_name: dbComp.country_name || undefined, // From ts_countries JOIN
                    cur_season_id: dbComp.cur_season_id || null,
                    cur_stage_id: dbComp.cur_stage_id || null,
                    primary_color: dbComp.primary_color || null,
                    secondary_color: dbComp.secondary_color || null,
                };
                map.set(dbComp.external_id, competition);
                // Cache it
                const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:competition:${dbComp.external_id}`;
                await cache_service_1.cacheService.set(cacheKey, competition, types_1.CacheTTL.Day);
            }
        }
        // 3. Fallback to API for still missing (should rarely happen)
        const stillMissing = competitionIds.filter(id => !map.has(id));
        if (stillMissing.length > 0) {
            logger_1.logger.debug(`Fetching ${stillMissing.length} competitions from API (not in DB)`);
            try {
                const list = await this.getCompetitionList();
                if (list && list.results && Array.isArray(list.results)) {
                    for (const comp of list.results) {
                        if (comp && comp.id && stillMissing.includes(comp.id)) {
                            map.set(comp.id, comp);
                            const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:competition:${comp.id}`;
                            await cache_service_1.cacheService.set(cacheKey, comp, types_1.CacheTTL.Day);
                        }
                    }
                }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to fetch competition list from API: ${error.message}`);
            }
        }
        return map;
    }
    /**
     * Enrich competition data from results_extra
     * CRITICAL: Saves to DB, not just cache (prevents foreign key constraint failures)
     */
    async enrichFromResultsExtra(resultsExtra) {
        if (!resultsExtra.competition) {
            return;
        }
        try {
            // Extract competition data from results_extra
            const competitions = resultsExtra.competition;
            const competitionsToSave = [];
            // Prepare competitions for DB save
            for (const [compId, compData] of Object.entries(competitions)) {
                if (!compId || compId === '0' || compId === '')
                    continue;
                const competition = {
                    id: compId,
                    name: compData.name || compData.name_en || compData.name_cn || 'Unknown Competition',
                    logo_url: compData.logo_url || compData.logo || null,
                    country_id: compData.country_id || undefined,
                    country_name: compData.country_name || undefined,
                };
                // Save to DB (CRITICAL: Prevents foreign key constraint failures)
                competitionsToSave.push({
                    external_id: compId,
                    name: competition.name,
                    logo_url: competition.logo_url || null,
                    country_id: competition.country_id || null,
                    category_id: compData.category_id || null,
                    type: compData.type || null,
                });
                // Also cache it
                const cacheKey = `${types_1.CacheKeyPrefix.TheSports}:competition:${compId}`;
                await cache_service_1.cacheService.set(cacheKey, competition, types_1.CacheTTL.Day);
            }
            // Batch save to DB
            if (competitionsToSave.length > 0) {
                await this.repository.batchUpsert(competitionsToSave);
                logger_1.logger.info(`✅ Saved ${competitionsToSave.length} competitions to DB from results_extra`);
            }
            logger_1.logger.debug(`Enriched ${Object.keys(competitions).length} competitions from results_extra`);
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to enrich competitions from results_extra:', error.message);
            throw error; // Re-throw to prevent silent failures
        }
    }
}
exports.CompetitionService = CompetitionService;
