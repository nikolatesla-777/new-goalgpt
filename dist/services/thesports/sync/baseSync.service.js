"use strict";
/**
 * Base Sync Service
 *
 * Generic base class for entity synchronization
 * Implements Full Update vs Incremental Update logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseSyncService = void 0;
const logger_1 = require("../../../utils/logger");
const dataFetcher_util_1 = require("./dataFetcher.util");
const SyncStateRepository_1 = require("../../../repositories/implementations/SyncStateRepository");
class BaseSyncService {
    constructor(entityType) {
        this.dataFetcher = new dataFetcher_util_1.DataFetcher();
        this.syncStateRepository = new SyncStateRepository_1.SyncStateRepository();
        this.entityType = entityType;
    }
    /**
     * Main sync method
     * Automatically chooses Full Update or Incremental Update based on sync state
     */
    async sync() {
        logger_1.logger.info(`Starting ${this.entityType} sync...`);
        // Get last sync state
        const lastUpdatedAt = await this.syncStateRepository.getLastUpdatedAt(this.entityType);
        let result;
        let isFullUpdate = false;
        if (lastUpdatedAt === null) {
            // Full Update: No previous sync state
            logger_1.logger.info(`No previous sync state found. Performing FULL UPDATE for ${this.entityType}...`);
            isFullUpdate = true;
            result = await this.fetchFullUpdate();
        }
        else {
            // Incremental Update: Use time parameter
            const timeParam = lastUpdatedAt + 1; // MAX(updated_at) + 1
            logger_1.logger.info(`Performing INCREMENTAL UPDATE for ${this.entityType} (time=${timeParam})...`);
            result = await this.fetchIncrementalUpdate(timeParam);
        }
        // Transform and save to database
        const synced = await this.saveToDatabase(result.items);
        // Update sync state with max updated_at
        if (result.maxUpdatedAt !== null) {
            await this.syncStateRepository.updateSyncState(this.entityType, result.maxUpdatedAt);
            logger_1.logger.info(`Updated sync state for ${this.entityType}: last_updated_at=${result.maxUpdatedAt}`);
        }
        else if (result.items.length > 0) {
            // If no updated_at field, use current timestamp
            const currentTimestamp = Math.floor(Date.now() / 1000);
            await this.syncStateRepository.updateSyncState(this.entityType, currentTimestamp);
        }
        logger_1.logger.info(`${this.entityType} sync completed: ${result.totalFetched} fetched, ${synced} synced, ${result.errors} errors (${isFullUpdate ? 'FULL' : 'INCREMENTAL'})`);
        return {
            total: result.totalFetched,
            synced,
            errors: result.errors,
            isFullUpdate,
        };
    }
}
exports.BaseSyncService = BaseSyncService;
