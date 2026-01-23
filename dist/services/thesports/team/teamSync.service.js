"use strict";
/**
 * Team Sync Service
 *
 * Fetches team/club data from TheSports API and stores in database
 * Uses /team/additional/list endpoint
 * Implements Full Update vs Incremental Update logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamSyncService = void 0;
const TeamRepository_1 = require("../../../repositories/implementations/TeamRepository");
const baseSync_service_1 = require("../sync/baseSync.service");
class TeamSyncService extends baseSync_service_1.BaseSyncService {
    constructor() {
        super('team');
        this.repository = new TeamRepository_1.TeamRepository();
    }
    /**
     * Get fetch options for team endpoint
     */
    getFetchOptions() {
        return {
            endpoint: '/team/additional/list',
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
     * Save teams to database
     */
    async saveToDatabase(items) {
        if (items.length === 0)
            return 0;
        const teamsToSave = items.map(team => ({
            external_id: team.id,
            name: team.name || 'Unknown Team',
            short_name: team.short_name || null,
            logo_url: team.logo || team.logo_url || null,
            website: team.website || null,
            national: team.national !== undefined ? (team.national === 1) : null, // Convert 1->true, 0->false
            foundation_time: team.foundation_time || null,
            competition_id: team.competition_id || null,
            country_id: team.country_id || null,
            venue_id: team.venue_id || null,
            coach_id: team.coach_id || null,
            uid: team.uid || null, // Master ID if duplicate
            updated_at: team.updated_at,
        }));
        const saved = await this.repository.batchUpsert(teamsToSave);
        return saved.length;
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use sync() instead
     */
    async syncAllTeams() {
        const result = await this.sync();
        return {
            total: result.total,
            synced: result.synced,
            errors: result.errors,
        };
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use sync() instead - it automatically handles incremental updates
     */
    async syncIncremental(lastSyncTime) {
        // If lastSyncTime provided, update sync state first
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
exports.TeamSyncService = TeamSyncService;
