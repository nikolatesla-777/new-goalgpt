"use strict";
/**
 * Coach Sync Service
 *
 * Fetches coach/manager data from TheSports API and stores in database
 * Uses /coach/list endpoint
 * Implements Full Update vs Incremental Update logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoachSyncService = void 0;
const CoachRepository_1 = require("../../../repositories/implementations/CoachRepository");
const baseSync_service_1 = require("../sync/baseSync.service");
class CoachSyncService extends baseSync_service_1.BaseSyncService {
    constructor() {
        super('coach');
        this.repository = new CoachRepository_1.CoachRepository();
    }
    /**
     * Get fetch options for coach endpoint
     */
    getFetchOptions() {
        return {
            endpoint: '/coach/list',
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
     * Save coaches to database
     */
    async saveToDatabase(items) {
        if (items.length === 0)
            return 0;
        const coachesToSave = items.map(coach => ({
            external_id: coach.id,
            name: coach.name || 'Unknown Coach',
            short_name: coach.short_name || null,
            logo: coach.logo || null,
            team_id: coach.team_id || null,
            country_id: coach.country_id || null,
            type: coach.type || null,
            birthday: coach.birthday || null,
            age: coach.age || null,
            preferred_formation: coach.preferred_formation || null,
            nationality: coach.nationality || null,
            joined: coach.joined || null,
            contract_until: coach.contract_until || null,
            uid: coach.uid || null, // Master ID if duplicate
            updated_at: coach.updated_at,
        }));
        const saved = await this.repository.batchUpsert(coachesToSave);
        return saved.length;
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use sync() instead
     */
    async syncAllCoaches() {
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
exports.CoachSyncService = CoachSyncService;
