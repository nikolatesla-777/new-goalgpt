"use strict";
/**
 * Schedule Sync Service
 *
 * Handles daily bulk sync - fetches all matches for a specific date
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleSyncService = void 0;
const TheSportsAPIManager_1 = require("../../../core/TheSportsAPIManager");
const logger_1 = require("../../../utils/logger");
const sync_strategy_1 = require("../sync/sync-strategy");
const timestamp_util_1 = require("../../../utils/thesports/timestamp.util");
class ScheduleSyncService {
    constructor() {
        this.client = TheSportsAPIManager_1.theSportsAPI;
    }
    /**
     * Daily bulk sync: Fetch all matches for a specific date
     */
    async syncDaily(date) {
        return (0, sync_strategy_1.withSyncLock)(sync_strategy_1.SyncType.SCHEDULE, async () => {
            const syncDate = date || new Date();
            const dateString = (0, timestamp_util_1.formatTheSportsDate)(syncDate);
            logger_1.logger.info(`Daily sync started for date: ${dateString}`);
            const response = await this.client.get('/match/diary', { date: dateString });
            logger_1.logger.info(`Daily sync completed: ${response.results.length} matches`);
            return response;
        });
    }
    /**
     * Sync multiple dates (for historical data)
     */
    async syncDateRange(startDate, endDate) {
        const results = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            try {
                const result = await this.syncDaily(new Date(currentDate));
                results.push(result);
            }
            catch (error) {
                logger_1.logger.error(`Failed to sync date ${(0, timestamp_util_1.formatTheSportsDate)(currentDate)}:`, error);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return results;
    }
}
exports.ScheduleSyncService = ScheduleSyncService;
