"use strict";
/**
 * League Sync Service
 *
 * Fetches competition/league data from TheSports API and stores in database
 * Uses /competition/additional/list endpoint
 * Implements Full Update vs Incremental Update logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeagueSyncService = void 0;
const CompetitionRepository_1 = require("../../../repositories/implementations/CompetitionRepository");
const baseSync_service_1 = require("../sync/baseSync.service");
class LeagueSyncService extends baseSync_service_1.BaseSyncService {
    constructor() {
        super('competition');
        this.repository = new CompetitionRepository_1.CompetitionRepository();
    }
    /**
     * Get fetch options for competition endpoint
     */
    getFetchOptions() {
        return {
            endpoint: '/competition/additional/list',
            rateLimitDelay: 200, // 200ms between pages
            timeout: 30000,
            retryOnRateLimit: true,
        };
    }
    /**
     * Fetch full update (all pages)
     */
    async fetchFullUpdate() {
        return this.dataFetcher.fetchAllPages(this.getFetchOptions());
    }
    /**
     * Fetch incremental update (with time parameter)
     */
    async fetchIncrementalUpdate(time) {
        return this.dataFetcher.fetchIncremental(this.getFetchOptions(), time);
    }
    /**
     * Save competitions to database
     */
    async saveToDatabase(items) {
        if (items.length === 0)
            return 0;
        const competitionsToSave = items.map(comp => ({
            external_id: comp.id,
            name: comp.name || comp.short_name || 'Unknown Competition',
            short_name: comp.short_name || null,
            logo_url: comp.logo || comp.logo_url || null,
            type: comp.type || null,
            category_id: comp.category_id || null,
            country_id: comp.country_id || null,
            cur_season_id: comp.cur_season_id || null,
            cur_stage_id: comp.cur_stage_id || null,
            primary_color: comp.primary_color || null,
            secondary_color: comp.secondary_color || null,
            uid: comp.uid || null, // Master ID if duplicate
        }));
        const saved = await this.repository.batchUpsert(competitionsToSave);
        return saved.length;
    }
    /**
     * Sync all competitions from API (Legacy compatibility)
     */
    async syncAllCompetitions() {
        const result = await this.sync();
        return {
            total: result.total,
            synced: result.synced,
            errors: result.errors,
        };
    }
    /**
     * Sync incremental (Legacy compatibility)
     */
    async syncIncremental(lastSyncTime) {
        if (lastSyncTime) {
            await this.syncStateRepository.updateSyncState(this.entityType, lastSyncTime);
        }
        const result = await this.sync();
        return {
            total: result.total,
            synced: result.synced,
        };
    }
}
exports.LeagueSyncService = LeagueSyncService;
