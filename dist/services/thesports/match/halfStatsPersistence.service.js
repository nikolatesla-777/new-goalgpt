"use strict";
/**
 * Half Stats Persistence Service
 *
 * Handles saving first-half and second-half statistics separately
 * for data persistence and user viewing (1. Yarı / 2. Yarı / Tümü)
 *
 * Key columns in ts_matches:
 * - first_half_stats: Statistics snapshot at halftime (already exists)
 * - statistics_second_half: Statistics for second half only (NEW)
 * - incidents_first_half: Events that occurred in first half (NEW)
 * - incidents_second_half: Events that occurred in second half (NEW)
 * - data_completeness: Tracking which data has been captured (NEW)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.halfStatsPersistenceService = exports.HalfStatsPersistenceService = void 0;
const connection_1 = require("../../../database/connection");
const logger_1 = require("../../../utils/logger");
class HalfStatsPersistenceService {
    constructor() {
        this.schemaChecked = false;
        this.hasStatisticsSecondHalf = false;
        this.hasIncidentsFirstHalf = false;
        this.hasIncidentsSecondHalf = false;
        this.hasDataCompleteness = false;
        this.hasFirstHalfStats = false;
    }
    /**
     * Check schema for new columns once
     */
    async ensureSchemaChecked(client) {
        if (this.schemaChecked)
            return;
        const res = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ts_matches'
        AND column_name IN (
          'first_half_stats',
          'statistics_second_half',
          'incidents_first_half',
          'incidents_second_half',
          'data_completeness'
        )
    `);
        const cols = new Set(res.rows.map((r) => r.column_name));
        this.hasFirstHalfStats = cols.has('first_half_stats');
        this.hasStatisticsSecondHalf = cols.has('statistics_second_half');
        this.hasIncidentsFirstHalf = cols.has('incidents_first_half');
        this.hasIncidentsSecondHalf = cols.has('incidents_second_half');
        this.hasDataCompleteness = cols.has('data_completeness');
        this.schemaChecked = true;
        logger_1.logger.info(`[HalfStatsPersistence] Schema check: ` +
            `first_half_stats=${this.hasFirstHalfStats}, ` +
            `statistics_second_half=${this.hasStatisticsSecondHalf}, ` +
            `incidents_first_half=${this.hasIncidentsFirstHalf}, ` +
            `incidents_second_half=${this.hasIncidentsSecondHalf}, ` +
            `data_completeness=${this.hasDataCompleteness}`);
    }
    /**
     * Save first half data when match reaches HALF_TIME (status 3)
     * Called by WebSocket service when status transitions to 3
     *
     * Saves:
     * - first_half_stats: Current statistics (already exists)
     * - incidents_first_half: Incidents where minute <= 45
     * - data_completeness.first_half: true
     */
    async saveFirstHalfData(matchId) {
        const client = await connection_1.pool.connect();
        try {
            await this.ensureSchemaChecked(client);
            // Get current statistics and incidents from database
            const existingResult = await client.query(`
        SELECT statistics, incidents, first_half_stats, data_completeness
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);
            if (existingResult.rows.length === 0) {
                logger_1.logger.warn(`[HalfStatsPersistence] Match ${matchId} not found in database`);
                return { success: false, statsCount: 0, incidentsCount: 0 };
            }
            const existing = existingResult.rows[0];
            // Check if first half data already saved
            if (existing.data_completeness?.first_half === true) {
                logger_1.logger.debug(`[HalfStatsPersistence] First half data already saved for ${matchId}, skipping`);
                return { success: true, statsCount: 0, incidentsCount: 0 };
            }
            // Prepare update parts
            const setParts = ['updated_at = NOW()'];
            const values = [];
            let paramIndex = 1;
            // Save first_half_stats if column exists and not already saved
            if (this.hasFirstHalfStats && !existing.first_half_stats) {
                const statistics = existing.statistics || [];
                setParts.push(`first_half_stats = $${paramIndex++}::jsonb`);
                values.push(JSON.stringify(statistics));
                logger_1.logger.info(`[HalfStatsPersistence] Saving first_half_stats for ${matchId} (${Array.isArray(statistics) ? statistics.length : 0} stats)`);
            }
            // Save incidents_first_half if column exists
            if (this.hasIncidentsFirstHalf) {
                const allIncidents = Array.isArray(existing.incidents) ? existing.incidents : [];
                // Filter incidents where minute <= 45 (first half)
                const firstHalfIncidents = allIncidents.filter((incident) => {
                    const minute = incident.time || incident.minute || 0;
                    return minute <= 45;
                });
                setParts.push(`incidents_first_half = $${paramIndex++}::jsonb`);
                values.push(JSON.stringify(firstHalfIncidents));
                logger_1.logger.info(`[HalfStatsPersistence] Saving incidents_first_half for ${matchId} (${firstHalfIncidents.length}/${allIncidents.length} incidents)`);
            }
            // Update data_completeness
            if (this.hasDataCompleteness) {
                const completeness = existing.data_completeness || { first_half: false, second_half: false, full_time: false };
                completeness.first_half = true;
                setParts.push(`data_completeness = $${paramIndex++}::jsonb`);
                values.push(JSON.stringify(completeness));
            }
            // No updates needed
            if (setParts.length === 1) {
                return { success: true, statsCount: 0, incidentsCount: 0 };
            }
            // Execute update
            values.push(matchId);
            const query = `
        UPDATE ts_matches
        SET ${setParts.join(', ')}
        WHERE external_id = $${paramIndex}
      `;
            const result = await client.query(query, values);
            if (result.rowCount === 0) {
                logger_1.logger.warn(`[HalfStatsPersistence] Update affected 0 rows for ${matchId}`);
                return { success: false, statsCount: 0, incidentsCount: 0 };
            }
            const statsCount = Array.isArray(existing.statistics) ? existing.statistics.length : 0;
            const incidentsCount = Array.isArray(existing.incidents)
                ? existing.incidents.filter((i) => (i.time || i.minute || 0) <= 45).length
                : 0;
            logger_1.logger.info(`[HalfStatsPersistence] First half data saved for ${matchId} (stats: ${statsCount}, incidents: ${incidentsCount})`);
            return { success: true, statsCount, incidentsCount };
        }
        catch (error) {
            logger_1.logger.error(`[HalfStatsPersistence] Error saving first half data for ${matchId}:`, error);
            return { success: false, statsCount: 0, incidentsCount: 0 };
        }
        finally {
            client.release();
        }
    }
    /**
     * Save second half data when match reaches END (status 8)
     * Called by WebSocket service when status transitions to 8
     *
     * Saves:
     * - statistics_second_half: Full stats - First half stats
     * - incidents_second_half: Incidents where minute > 45
     * - data_completeness.full_time: true
     */
    async saveSecondHalfData(matchId) {
        const client = await connection_1.pool.connect();
        try {
            await this.ensureSchemaChecked(client);
            // Get current statistics, first half stats, and incidents from database
            const existingResult = await client.query(`
        SELECT statistics, first_half_stats, incidents, data_completeness
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);
            if (existingResult.rows.length === 0) {
                logger_1.logger.warn(`[HalfStatsPersistence] Match ${matchId} not found in database`);
                return { success: false, statsCount: 0, incidentsCount: 0 };
            }
            const existing = existingResult.rows[0];
            // Check if full time data already saved
            if (existing.data_completeness?.full_time === true) {
                logger_1.logger.debug(`[HalfStatsPersistence] Full time data already saved for ${matchId}, skipping`);
                return { success: true, statsCount: 0, incidentsCount: 0 };
            }
            // Prepare update parts
            const setParts = ['updated_at = NOW()'];
            const values = [];
            let paramIndex = 1;
            // Calculate and save statistics_second_half if column exists
            if (this.hasStatisticsSecondHalf) {
                const fullStats = Array.isArray(existing.statistics) ? existing.statistics : [];
                const firstHalfStats = Array.isArray(existing.first_half_stats) ? existing.first_half_stats : [];
                // Calculate second half stats: full - first half
                const secondHalfStats = this.calculateSecondHalfStats(fullStats, firstHalfStats);
                setParts.push(`statistics_second_half = $${paramIndex++}::jsonb`);
                values.push(JSON.stringify(secondHalfStats));
                logger_1.logger.info(`[HalfStatsPersistence] Saving statistics_second_half for ${matchId} (${secondHalfStats.length} stats)`);
            }
            // Save incidents_second_half if column exists
            if (this.hasIncidentsSecondHalf) {
                const allIncidents = Array.isArray(existing.incidents) ? existing.incidents : [];
                // Filter incidents where minute > 45 (second half)
                const secondHalfIncidents = allIncidents.filter((incident) => {
                    const minute = incident.time || incident.minute || 0;
                    return minute > 45;
                });
                setParts.push(`incidents_second_half = $${paramIndex++}::jsonb`);
                values.push(JSON.stringify(secondHalfIncidents));
                logger_1.logger.info(`[HalfStatsPersistence] Saving incidents_second_half for ${matchId} (${secondHalfIncidents.length}/${allIncidents.length} incidents)`);
            }
            // Update data_completeness
            if (this.hasDataCompleteness) {
                const completeness = existing.data_completeness || { first_half: false, second_half: false, full_time: false };
                completeness.second_half = true;
                completeness.full_time = true;
                setParts.push(`data_completeness = $${paramIndex++}::jsonb`);
                values.push(JSON.stringify(completeness));
            }
            // No updates needed
            if (setParts.length === 1) {
                return { success: true, statsCount: 0, incidentsCount: 0 };
            }
            // Execute update
            values.push(matchId);
            const query = `
        UPDATE ts_matches
        SET ${setParts.join(', ')}
        WHERE external_id = $${paramIndex}
      `;
            const result = await client.query(query, values);
            if (result.rowCount === 0) {
                logger_1.logger.warn(`[HalfStatsPersistence] Update affected 0 rows for ${matchId}`);
                return { success: false, statsCount: 0, incidentsCount: 0 };
            }
            const statsCount = Array.isArray(existing.statistics) ? existing.statistics.length : 0;
            const incidentsCount = Array.isArray(existing.incidents)
                ? existing.incidents.filter((i) => (i.time || i.minute || 0) > 45).length
                : 0;
            logger_1.logger.info(`[HalfStatsPersistence] Second half data saved for ${matchId} (stats: ${statsCount}, incidents: ${incidentsCount})`);
            return { success: true, statsCount, incidentsCount };
        }
        catch (error) {
            logger_1.logger.error(`[HalfStatsPersistence] Error saving second half data for ${matchId}:`, error);
            return { success: false, statsCount: 0, incidentsCount: 0 };
        }
        finally {
            client.release();
        }
    }
    /**
     * Calculate second half stats by subtracting first half from full time
     * Each stat type: { type: number, home: number, away: number }
     */
    calculateSecondHalfStats(fullStats, firstHalfStats) {
        if (!Array.isArray(fullStats) || fullStats.length === 0) {
            return [];
        }
        if (!Array.isArray(firstHalfStats) || firstHalfStats.length === 0) {
            // No first half stats, return full stats as second half
            return fullStats;
        }
        // Create a map of first half stats by type
        const firstHalfMap = new Map();
        for (const stat of firstHalfStats) {
            firstHalfMap.set(stat.type, { home: stat.home || 0, away: stat.away || 0 });
        }
        // Calculate second half stats
        const secondHalfStats = [];
        for (const stat of fullStats) {
            const firstHalf = firstHalfMap.get(stat.type);
            const secondHalf = {
                type: stat.type,
                home: Math.max(0, (stat.home || 0) - (firstHalf?.home || 0)),
                away: Math.max(0, (stat.away || 0) - (firstHalf?.away || 0)),
            };
            secondHalfStats.push(secondHalf);
        }
        return secondHalfStats;
    }
    /**
     * Get half statistics for a match (for API endpoint)
     * Returns separate first half, second half, and full time stats
     */
    async getHalfStats(matchId) {
        const client = await connection_1.pool.connect();
        try {
            await this.ensureSchemaChecked(client);
            const result = await client.query(`
        SELECT
          statistics,
          first_half_stats,
          statistics_second_half,
          incidents,
          incidents_first_half,
          incidents_second_half,
          data_completeness
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);
            if (result.rows.length === 0) {
                return {
                    firstHalf: null,
                    secondHalf: null,
                    fullTime: null,
                    dataCompleteness: { first_half: false, second_half: false, full_time: false },
                };
            }
            const row = result.rows[0];
            return {
                firstHalf: {
                    stats: row.first_half_stats || [],
                    incidents: row.incidents_first_half || [],
                },
                secondHalf: {
                    stats: row.statistics_second_half || [],
                    incidents: row.incidents_second_half || [],
                },
                fullTime: {
                    stats: row.statistics || [],
                    incidents: row.incidents || [],
                },
                dataCompleteness: row.data_completeness || { first_half: false, second_half: false, full_time: false },
            };
        }
        finally {
            client.release();
        }
    }
    /**
     * Check if first half data has been saved for a match
     */
    async hasFirstHalfData(matchId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT data_completeness->'first_half' as first_half
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);
            return result.rows[0]?.first_half === true;
        }
        finally {
            client.release();
        }
    }
    /**
     * Check if full time data has been saved for a match
     */
    async hasFullTimeData(matchId) {
        const client = await connection_1.pool.connect();
        try {
            const result = await client.query(`
        SELECT data_completeness->'full_time' as full_time
        FROM ts_matches
        WHERE external_id = $1
      `, [matchId]);
            return result.rows[0]?.full_time === true;
        }
        finally {
            client.release();
        }
    }
}
exports.HalfStatsPersistenceService = HalfStatsPersistenceService;
// Export singleton instance
exports.halfStatsPersistenceService = new HalfStatsPersistenceService();
