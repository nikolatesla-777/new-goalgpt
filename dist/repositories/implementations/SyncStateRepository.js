"use strict";
/**
 * Sync State Repository
 *
 * Manages sync state tracking for incremental updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncStateRepository = void 0;
const BaseRepository_1 = require("../base/BaseRepository");
class SyncStateRepository extends BaseRepository_1.BaseRepository {
    constructor() {
        super('ts_sync_state', 'entity_type');
    }
    /**
     * Get last updated_at timestamp for an entity type
     * Returns null if no sync has been performed (triggers full update)
     */
    async getLastUpdatedAt(entityType) {
        const query = `SELECT last_updated_at FROM ${this.tableName} WHERE entity_type = $1`;
        const rows = await this.executeQuery(query, [entityType]);
        return rows.length > 0 ? rows[0].last_updated_at : null;
    }
    /**
     * Get last sync time (alias for getLastUpdatedAt for compatibility)
     */
    async getLastSyncTime(entityType) {
        const query = `SELECT last_updated_at, last_sync_at FROM ${this.tableName} WHERE entity_type = $1`;
        const rows = await this.executeQuery(query, [entityType]);
        return rows.length > 0 ? rows[0] : null;
    }
    /**
     * Update last sync time (alias for updateSyncState for compatibility)
     */
    async updateLastSyncTime(entityType, lastUpdatedAt) {
        await this.updateSyncState(entityType, lastUpdatedAt);
    }
    /**
     * Update sync state after successful sync
     * @param entityType - Entity type (e.g., 'competition', 'team')
     * @param maxUpdatedAt - Maximum updated_at timestamp from the synced records
     */
    async updateSyncState(entityType, maxUpdatedAt) {
        const query = `
      INSERT INTO ${this.tableName} (entity_type, last_updated_at, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (entity_type) 
      DO UPDATE SET 
        last_updated_at = $2,
        last_sync_at = NOW(),
        updated_at = NOW()
    `;
        await this.executeQuery(query, [entityType, maxUpdatedAt]);
    }
    /**
     * Reset sync state (force full update on next sync)
     */
    async resetSyncState(entityType) {
        const query = `
      DELETE FROM ${this.tableName} WHERE entity_type = $1
    `;
        await this.executeQuery(query, [entityType]);
    }
}
exports.SyncStateRepository = SyncStateRepository;
