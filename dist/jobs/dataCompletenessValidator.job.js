"use strict";
/**
 * Data Completeness Validator Job
 *
 * Background job that runs every 5 minutes to:
 * 1. Find matches with status=8 (END) that have incomplete data
 * 2. Re-fetch and save the missing data
 *
 * This ensures data persistence even when WebSocket misses events or API calls fail.
 *
 * Checks for:
 * - Missing first_half_stats
 * - Missing statistics_second_half
 * - Missing statistics (full time)
 * - data_completeness flags not set
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataCompletenessValidatorJob = exports.DataCompletenessValidatorJob = void 0;
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
const halfStatsPersistence_service_1 = require("../services/thesports/match/halfStatsPersistence.service");
class DataCompletenessValidatorJob {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        // Configuration
        this.INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
        this.LOOKBACK_HOURS = 24; // Check matches from last 24 hours
        this.BATCH_SIZE = 50; // Process max 50 matches per tick
    }
    /**
     * Main tick function - runs every 5 minutes
     */
    async tick() {
        if (this.isRunning) {
            logger_1.logger.debug('[DataCompleteness] Tick already running, skipping');
            return;
        }
        this.isRunning = true;
        const startTime = Date.now();
        let processedCount = 0;
        let fixedCount = 0;
        let errorCount = 0;
        try {
            logger_1.logger.info('[DataCompleteness] Starting data completeness validation...');
            // Find matches with incomplete data
            const incompleteMatches = await this.findIncompleteMatches();
            if (incompleteMatches.length === 0) {
                logger_1.logger.debug('[DataCompleteness] No incomplete matches found');
                (0, obsLogger_1.logEvent)('info', 'data_completeness.tick.summary', {
                    processed_count: 0,
                    fixed_count: 0,
                    error_count: 0,
                    duration_ms: Date.now() - startTime,
                });
                return;
            }
            logger_1.logger.info(`[DataCompleteness] Found ${incompleteMatches.length} matches with incomplete data`);
            // Process each incomplete match
            for (const match of incompleteMatches) {
                processedCount++;
                try {
                    const result = await this.fixIncompleteMatch(match);
                    if (result.fixed) {
                        fixedCount++;
                        logger_1.logger.info(`[DataCompleteness] Fixed match ${match.external_id}: ` +
                            `firstHalf=${result.firstHalfFixed}, secondHalf=${result.secondHalfFixed}`);
                    }
                }
                catch (error) {
                    errorCount++;
                    logger_1.logger.warn(`[DataCompleteness] Error fixing match ${match.external_id}:`, error.message);
                }
            }
            const duration = Date.now() - startTime;
            logger_1.logger.info(`[DataCompleteness] Completed: processed=${processedCount}, fixed=${fixedCount}, ` +
                `errors=${errorCount}, duration=${duration}ms`);
            (0, obsLogger_1.logEvent)('info', 'data_completeness.tick.summary', {
                processed_count: processedCount,
                fixed_count: fixedCount,
                error_count: errorCount,
                duration_ms: duration,
            });
        }
        catch (error) {
            logger_1.logger.error('[DataCompleteness] Error in tick:', error);
            (0, obsLogger_1.logEvent)('error', 'data_completeness.tick.error', {
                error_message: error.message,
                duration_ms: Date.now() - startTime,
            });
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Find matches with incomplete data
     *
     * A match is considered incomplete if:
     * - status_id = 8 (END)
     * - match_time is within last 24 hours
     * - Any of the following are true:
     *   - data_completeness->>'first_half' = 'false'
     *   - data_completeness->>'full_time' = 'false'
     *   - first_half_stats IS NULL
     *   - statistics IS NULL or empty
     */
    async findIncompleteMatches() {
        const client = await connection_1.pool.connect();
        try {
            // Check if required columns exist
            const schemaCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'ts_matches'
          AND column_name IN ('data_completeness', 'first_half_stats', 'statistics', 'statistics_second_half')
      `);
            const columns = new Set(schemaCheck.rows.map((r) => r.column_name));
            const hasDataCompleteness = columns.has('data_completeness');
            const hasFirstHalfStats = columns.has('first_half_stats');
            const hasStatistics = columns.has('statistics');
            if (!hasDataCompleteness && !hasFirstHalfStats) {
                logger_1.logger.debug('[DataCompleteness] Required columns not found, skipping');
                return [];
            }
            // Build dynamic query based on available columns
            const selectParts = [
                'external_id',
                'status_id',
                'match_time',
            ];
            const whereParts = [
                'status_id = 8',
                `match_time > ${Math.floor(Date.now() / 1000) - (this.LOOKBACK_HOURS * 60 * 60)}`,
            ];
            const incompleteConditions = [];
            if (hasDataCompleteness) {
                selectParts.push('data_completeness');
                incompleteConditions.push(`data_completeness->>'first_half' = 'false'`);
                incompleteConditions.push(`data_completeness->>'full_time' = 'false'`);
                incompleteConditions.push(`data_completeness IS NULL`);
            }
            if (hasFirstHalfStats) {
                selectParts.push(`(first_half_stats IS NOT NULL AND jsonb_array_length(COALESCE(first_half_stats, '[]')) > 0) AS has_first_half_stats`);
                incompleteConditions.push(`first_half_stats IS NULL`);
                incompleteConditions.push(`jsonb_array_length(COALESCE(first_half_stats, '[]')) = 0`);
            }
            else {
                selectParts.push('false AS has_first_half_stats');
            }
            if (hasStatistics) {
                selectParts.push(`(statistics IS NOT NULL AND jsonb_array_length(COALESCE(statistics, '[]')) > 0) AS has_statistics`);
                incompleteConditions.push(`statistics IS NULL`);
                incompleteConditions.push(`jsonb_array_length(COALESCE(statistics, '[]')) = 0`);
            }
            else {
                selectParts.push('false AS has_statistics');
            }
            // Build incomplete condition
            if (incompleteConditions.length > 0) {
                whereParts.push(`(${incompleteConditions.join(' OR ')})`);
            }
            const query = `
        SELECT ${selectParts.join(', ')}
        FROM ts_matches
        WHERE ${whereParts.join(' AND ')}
        ORDER BY match_time DESC
        LIMIT ${this.BATCH_SIZE}
      `;
            const result = await client.query(query);
            return result.rows.map((row) => ({
                external_id: row.external_id,
                status_id: row.status_id,
                match_time: row.match_time,
                data_completeness: row.data_completeness || null,
                has_first_half_stats: row.has_first_half_stats || false,
                has_statistics: row.has_statistics || false,
            }));
        }
        finally {
            client.release();
        }
    }
    /**
     * Fix incomplete match data
     *
     * Attempts to save missing first half and second half data
     */
    async fixIncompleteMatch(match) {
        let firstHalfFixed = false;
        let secondHalfFixed = false;
        const completeness = match.data_completeness || { first_half: false, second_half: false, full_time: false };
        // Fix first half data if missing
        if (!completeness.first_half) {
            const result = await halfStatsPersistence_service_1.halfStatsPersistenceService.saveFirstHalfData(match.external_id);
            if (result.success && (result.statsCount > 0 || result.incidentsCount > 0)) {
                firstHalfFixed = true;
                (0, obsLogger_1.logEvent)('info', 'data_completeness.fix.first_half', {
                    match_id: match.external_id,
                    stats_count: result.statsCount,
                    incidents_count: result.incidentsCount,
                });
            }
        }
        // Fix second half / full time data if missing
        if (!completeness.full_time) {
            const result = await halfStatsPersistence_service_1.halfStatsPersistenceService.saveSecondHalfData(match.external_id);
            if (result.success && (result.statsCount > 0 || result.incidentsCount > 0)) {
                secondHalfFixed = true;
                (0, obsLogger_1.logEvent)('info', 'data_completeness.fix.second_half', {
                    match_id: match.external_id,
                    stats_count: result.statsCount,
                    incidents_count: result.incidentsCount,
                });
            }
        }
        return {
            fixed: firstHalfFixed || secondHalfFixed,
            firstHalfFixed,
            secondHalfFixed,
        };
    }
    /**
     * Start the job
     */
    start() {
        if (this.intervalId) {
            logger_1.logger.warn('[DataCompleteness] Job already running');
            return;
        }
        logger_1.logger.info(`[DataCompleteness] Starting job (interval: ${this.INTERVAL_MS / 1000}s)`);
        // Run immediately on start
        void this.tick();
        // Schedule periodic runs
        this.intervalId = setInterval(() => {
            void this.tick();
        }, this.INTERVAL_MS);
        (0, obsLogger_1.logEvent)('info', 'worker.started', {
            worker: 'DataCompletenessValidatorJob',
            interval_sec: this.INTERVAL_MS / 1000,
        });
    }
    /**
     * Stop the job
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger_1.logger.info('[DataCompleteness] Job stopped');
        }
    }
}
exports.DataCompletenessValidatorJob = DataCompletenessValidatorJob;
// Export singleton instance
exports.dataCompletenessValidatorJob = new DataCompletenessValidatorJob();
