"use strict";
/**
 * Stats Sync Job - Phase 6 Implementation
 *
 * Background job to proactively sync match statistics for live matches.
 * Fetches from TheSports API /match/team_stats/list endpoint which returns
 * all stats that changed in the last 120 seconds.
 *
 * Schedule: Every minute (when live matches exist)
 * Data flow: TheSports API → ts_match_stats table → getMatchFull endpoint
 *
 * Benefits:
 * - Stats always fresh in database (no API call needed in getMatchFull)
 * - Single API call fetches ALL live match stats (batch efficiency)
 * - Reduces API latency from user-facing requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStatsSync = runStatsSync;
exports.getStatsSyncStatus = getStatsSyncStatus;
exports.resetStatsSyncCircuit = resetStatsSyncCircuit;
const TheSportsAPIManager_1 = require("../core/TheSportsAPIManager");
const connection_1 = require("../database/connection");
const logger_1 = require("../utils/logger");
const obsLogger_1 = require("../utils/obsLogger");
const matchStats_repository_1 = require("../repositories/matchStats.repository");
const memoryCache_1 = require("../utils/cache/memoryCache");
// Job state tracking
let isRunning = false;
let lastRunTime = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
/**
 * Stats type mapping from TheSports API
 * API returns array indexed by type: [corner, yellow, red, ...]
 */
const STAT_TYPE_MAP = {
    0: { home: 'home_corner', away: 'away_corner' },
    1: { home: 'home_yellow_cards', away: 'away_yellow_cards' },
    2: { home: 'home_red_cards', away: 'away_red_cards' },
    3: { home: 'home_shots', away: 'away_shots' },
    4: { home: 'home_shots_on_target', away: 'away_shots_on_target' },
    5: { home: 'home_attacks', away: 'away_attacks' },
    6: { home: 'home_dangerous_attacks', away: 'away_dangerous_attacks' },
    7: { home: 'home_possession', away: 'away_possession' },
    8: { home: 'home_passes', away: 'away_passes' },
    9: { home: 'home_accurate_passes', away: 'away_accurate_passes' },
    10: { home: 'home_fouls', away: 'away_fouls' },
    11: { home: 'home_offsides', away: 'away_offsides' },
};
/**
 * Check if there are live matches in database
 * Optimization: Skip API call if no live matches
 */
async function hasLiveMatches() {
    try {
        const result = await connection_1.pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM ts_matches
        WHERE status_id IN (2, 3, 4, 5, 7)
        LIMIT 1
      ) as has_live
    `);
        return result.rows[0]?.has_live === true;
    }
    catch (error) {
        logger_1.logger.warn('[StatsSync] Failed to check live matches, assuming true');
        return true;
    }
}
/**
 * Parse stats from TheSports API format
 * API returns: { id: matchId, stats: [[home_vals], [away_vals]] }
 */
function parseStatsFromApi(apiMatch) {
    const matchId = apiMatch.id || apiMatch.match_id;
    if (!matchId)
        return null;
    const stats = { match_id: matchId };
    // Parse stats array: [[home_vals...], [away_vals...]]
    if (Array.isArray(apiMatch.stats) && apiMatch.stats.length >= 2) {
        const homeStats = apiMatch.stats[0] || [];
        const awayStats = apiMatch.stats[1] || [];
        // Map each stat type to its field
        for (const [index, mapping] of Object.entries(STAT_TYPE_MAP)) {
            const idx = parseInt(index);
            const map = mapping;
            if (homeStats[idx] !== undefined) {
                stats[map.home] = homeStats[idx];
            }
            if (awayStats[idx] !== undefined) {
                stats[map.away] = awayStats[idx];
            }
        }
    }
    return stats;
}
/**
 * Main sync function
 * Fetches all changed stats from API and saves to database
 */
async function runStatsSync() {
    // Prevent concurrent runs
    if (isRunning) {
        logger_1.logger.debug('[StatsSync] Already running, skipping');
        return;
    }
    // Circuit breaker: Stop after too many consecutive errors
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logger_1.logger.warn(`[StatsSync] Circuit breaker open (${consecutiveErrors} errors), skipping`);
        return;
    }
    isRunning = true;
    const startTime = Date.now();
    try {
        // Optimization: Skip if no live matches
        const hasLive = await hasLiveMatches();
        if (!hasLive) {
            logger_1.logger.debug('[StatsSync] No live matches, skipping');
            isRunning = false;
            return;
        }
        // Fetch all stats that changed in last 120 seconds
        // This is a batch endpoint - one call returns all live match stats
        const response = await TheSportsAPIManager_1.theSportsAPI.get('/match/team_stats/list');
        if (!response?.results || !Array.isArray(response.results)) {
            logger_1.logger.debug('[StatsSync] No stats data from API');
            consecutiveErrors = 0;
            isRunning = false;
            return;
        }
        const matches = response.results;
        let successCount = 0;
        let errorCount = 0;
        // Process each match's stats
        for (const apiMatch of matches) {
            try {
                const stats = parseStatsFromApi(apiMatch);
                if (stats && stats.match_id) {
                    const success = await matchStats_repository_1.matchStatsRepository.upsertStats(stats);
                    if (success) {
                        successCount++;
                        // Invalidate memory cache for this match
                        memoryCache_1.memoryCache.invalidateMatch(stats.match_id);
                    }
                    else {
                        errorCount++;
                    }
                }
            }
            catch (err) {
                errorCount++;
                logger_1.logger.error(`[StatsSync] Error processing match stats:`, err.message);
            }
        }
        const duration = Date.now() - startTime;
        lastRunTime = new Date();
        consecutiveErrors = 0;
        // Log success
        if (successCount > 0) {
            logger_1.logger.info(`[StatsSync] Synced ${successCount} match stats in ${duration}ms (${errorCount} errors)`);
            (0, obsLogger_1.logEvent)('info', 'stats_sync.completed', {
                matches: matches.length,
                synced: successCount,
                errors: errorCount,
                duration_ms: duration,
            });
        }
        else {
            logger_1.logger.debug(`[StatsSync] No stats to sync (${matches.length} matches checked)`);
        }
    }
    catch (error) {
        consecutiveErrors++;
        logger_1.logger.error(`[StatsSync] Job failed (attempt ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error.message);
        (0, obsLogger_1.logEvent)('error', 'stats_sync.failed', {
            error: error.message,
            consecutive_errors: consecutiveErrors,
        });
    }
    finally {
        isRunning = false;
    }
}
/**
 * Get job status for monitoring
 */
function getStatsSyncStatus() {
    return {
        isRunning,
        lastRunTime,
        consecutiveErrors,
        circuitOpen: consecutiveErrors >= MAX_CONSECUTIVE_ERRORS,
    };
}
/**
 * Reset circuit breaker (for admin use)
 */
function resetStatsSyncCircuit() {
    consecutiveErrors = 0;
    logger_1.logger.info('[StatsSync] Circuit breaker reset');
}
