"use strict";
/**
 * Player Sync Service
 *
 * Fetches player data from TheSports API and stores in database
 * Uses /player/with_stat/list endpoint
 * Implements Full Update vs Incremental Update logic
 * High volume data - optimized for batch processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerSyncService = void 0;
const logger_1 = require("../../../utils/logger");
const PlayerRepository_1 = require("../../../repositories/implementations/PlayerRepository");
const baseSync_service_1 = require("../sync/baseSync.service");
class PlayerSyncService extends baseSync_service_1.BaseSyncService {
    constructor() {
        super('player');
        this.batchSize = 1000; // Batch size for database inserts
        this.repository = new PlayerRepository_1.PlayerRepository();
    }
    /**
     * Get fetch options for player endpoint
     */
    getFetchOptions() {
        return {
            endpoint: '/player/with_stat/list',
            rateLimitDelay: 500, // 500ms between pages (slower due to high volume)
            timeout: 60000, // Longer timeout for high volume
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
     * Save players to database (with batch processing)
     */
    async saveToDatabase(items) {
        if (items.length === 0)
            return 0;
        // Process in batches to avoid memory issues
        let totalSynced = 0;
        for (let i = 0; i < items.length; i += this.batchSize) {
            const batch = items.slice(i, i + this.batchSize);
            const playersToSave = batch.map(player => {
                // CRITICAL: Convert team_id "0" to null (Free Agent/Retired)
                const teamId = player.team_id === '0' || player.team_id === '' ? null : (player.team_id || null);
                return {
                    external_id: player.id,
                    name: player.name || 'Unknown Player',
                    short_name: player.short_name || null,
                    logo: player.logo || null,
                    team_id: teamId,
                    country_id: player.country_id || null,
                    age: player.age || null,
                    birthday: player.birthday || null,
                    height: player.height || null,
                    weight: player.weight || null,
                    market_value: player.market_value || null,
                    market_value_currency: player.market_value_currency || null,
                    contract_until: player.contract_until || null,
                    preferred_foot: player.preferred_foot || null,
                    position: player.position || null,
                    positions: player.positions || null,
                    ability: player.ability || null,
                    characteristics: player.characteristics || null,
                    uid: player.uid || null, // Master ID if duplicate
                    updated_at: player.updated_at,
                };
            });
            try {
                const saved = await this.repository.batchUpsert(playersToSave, this.batchSize);
                totalSynced += saved.length;
                logger_1.logger.debug(`Synced batch: ${saved.length} players (total: ${totalSynced})`);
            }
            catch (error) {
                logger_1.logger.error(`Failed to save player batch:`, error.message);
                // Continue with next batch
            }
        }
        return totalSynced;
    }
    /**
     * Legacy method for backward compatibility
     * @deprecated Use sync() instead
     */
    async syncAllPlayers() {
        const result = await this.sync();
        return {
            total: result.total,
            synced: result.synced,
            errors: result.errors,
        };
    }
}
exports.PlayerSyncService = PlayerSyncService;
