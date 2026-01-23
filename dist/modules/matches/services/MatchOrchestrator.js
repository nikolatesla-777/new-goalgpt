"use strict";
/**
 * Match Orchestrator - Single Write Gate for ts_matches
 *
 * PR-6: Match Orchestrator
 *
 * This is the ONLY entry point for updating ts_matches table.
 * All jobs (watchdog, sync, dataUpdate) MUST use this orchestrator.
 *
 * Features:
 * - Advisory lock per match (external_id based) via pg_try_advisory_lock
 * - Atomic read-modify-write pattern
 * - Source priority (admin > watchdog > api/sync > computed/dataUpdate)
 * - Dedupe by timestamp (newer wins)
 * - Immutable finished matches (status=8 cannot be overwritten to live)
 *
 * Usage:
 *   import { matchOrchestrator } from '../modules/matches/services/MatchOrchestrator';
 *
 *   const result = await matchOrchestrator.updateMatch('12345678', [
 *     { field: 'status_id', value: 4, source: 'watchdog', priority: 3, timestamp: nowTs },
 *     { field: 'minute', value: 46, source: 'computed', priority: 1, timestamp: nowTs },
 *   ]);
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchOrchestratorClass = exports.matchOrchestrator = exports.MatchOrchestrator = void 0;
const match_repository_1 = require("../../../repositories/match.repository");
const lockKeys_1 = require("../../../jobs/lockKeys");
const logger_1 = require("../../../utils/logger");
const obsLogger_1 = require("../../../utils/obsLogger");
// ============================================================
// MATCH ORCHESTRATOR CLASS
// ============================================================
class MatchOrchestrator {
    constructor(config = {}) {
        this.config = {
            debug: false,
            skipLock: false,
            allowOverwriteFinished: false,
            ...config,
        };
    }
    /**
     * Get singleton instance
     */
    static getInstance(config) {
        if (!MatchOrchestrator.instance) {
            MatchOrchestrator.instance = new MatchOrchestrator(config);
        }
        return MatchOrchestrator.instance;
    }
    /**
     * Reset singleton (for testing)
     */
    static resetInstance() {
        MatchOrchestrator.instance = null;
    }
    // ============================================================
    // MAIN UPDATE METHOD
    // ============================================================
    /**
     * Update match with advisory lock and priority-based conflict resolution
     *
     * @param matchId - The external_id of the match
     * @param updates - Array of field updates with source/priority/timestamp
     * @param source - The source of the update (for logging)
     * @returns UpdateResult with status and updated fields
     */
    async updateMatch(matchId, updates, source = 'unknown') {
        if (updates.length === 0) {
            return { status: 'success', fieldsUpdated: [] };
        }
        const lockKey = lockKeys_1.LOCK_KEYS.matchUpdateLock(matchId);
        // PR-8B.1: Skip update if matchId is invalid (lockKey === null)
        if (lockKey === null) {
            logger_1.logger.debug(`[MatchOrchestrator] Skipping update for invalid matchId: ${matchId}`);
            return { status: 'rejected_invalid', fieldsUpdated: [], reason: 'invalid_match_id' };
        }
        let lockAcquired = false;
        const startTime = Date.now();
        try {
            // Step 1: Acquire advisory lock (non-blocking)
            if (!this.config.skipLock) {
                lockAcquired = await match_repository_1.matchRepository.tryAcquireLock(lockKey);
                if (!lockAcquired) {
                    if (this.config.debug) {
                        logger_1.logger.debug(`[MatchOrchestrator] Lock busy for match ${matchId}`);
                    }
                    (0, obsLogger_1.logEvent)('warn', 'orchestrator.lock_busy', { matchId, source });
                    return { status: 'rejected_locked', fieldsUpdated: [], reason: 'Lock held by another process' };
                }
            }
            // Step 2: Read current state
            const current = await match_repository_1.matchRepository.getMatchUpdateState(matchId);
            if (!current) {
                logger_1.logger.warn(`[MatchOrchestrator] Match ${matchId} not found`);
                return { status: 'not_found', fieldsUpdated: [], reason: 'Match not found' };
            }
            // Step 3: Check immutability (finished matches)
            const statusUpdate = updates.find(u => u.field === 'status_id');
            if (current.status_id === 8 && statusUpdate && statusUpdate.value !== 8) {
                // Match is finished, reject any attempt to change status to non-finished
                if (!this.config.allowOverwriteFinished && source !== 'admin') {
                    logger_1.logger.warn(`[MatchOrchestrator] REJECT: Match ${matchId} is finished (status=8), ` +
                        `cannot change to status=${statusUpdate.value}. Source: ${source}`);
                    (0, obsLogger_1.logEvent)('warn', 'orchestrator.rejected_immutable', {
                        matchId,
                        source,
                        attemptedStatus: statusUpdate.value,
                    });
                    return {
                        status: 'rejected_immutable',
                        fieldsUpdated: [],
                        reason: 'Match is finished (status=8) and cannot be changed',
                    };
                }
            }
            // Step 4: Filter updates by priority and timestamp
            const filteredUpdates = this.filterUpdatesByPriority(matchId, updates, current, source);
            if (filteredUpdates.length === 0) {
                if (this.config.debug) {
                    logger_1.logger.debug(`[MatchOrchestrator] No updates passed priority filter for ${matchId}`);
                }
                return { status: 'rejected_stale', fieldsUpdated: [], reason: 'Updates rejected by priority filter' };
            }
            // Step 5: Apply updates atomically
            const repoResult = await match_repository_1.matchRepository.updateFields(matchId, filteredUpdates);
            const duration = Date.now() - startTime;
            if (repoResult.status === 'success') {
                (0, obsLogger_1.logEvent)('info', 'orchestrator.update_success', {
                    matchId,
                    source,
                    fieldsUpdated: repoResult.fieldsUpdated,
                    duration_ms: duration,
                });
            }
            // Map repository result to UpdateResult
            const statusMap = {
                success: 'success',
                not_found: 'not_found',
                error: 'error',
            };
            const mappedStatus = statusMap[repoResult.status] ?? 'error';
            return {
                status: mappedStatus,
                fieldsUpdated: repoResult.fieldsUpdated,
            };
        }
        catch (error) {
            logger_1.logger.error(`[MatchOrchestrator] Error updating match ${matchId}:`, error);
            (0, obsLogger_1.logEvent)('error', 'orchestrator.update_error', {
                matchId,
                source,
                error: error.message,
            });
            return { status: 'error', fieldsUpdated: [], reason: error.message };
        }
        finally {
            // Step 6: ALWAYS release lock
            if (lockAcquired && !this.config.skipLock) {
                try {
                    await match_repository_1.matchRepository.releaseLock(lockKey);
                }
                catch (e) {
                    logger_1.logger.error(`[MatchOrchestrator] Failed to release lock for ${matchId}:`, e.message);
                }
            }
        }
    }
    // ============================================================
    // PRIORITY FILTERING
    // ============================================================
    /**
     * Filter updates based on source priority and timestamp
     *
     * Rules:
     * 1. Higher priority source always wins (admin > watchdog > api > computed)
     * 2. For same priority, newer timestamp wins
     * 3. For same priority and timestamp, accept update (no change needed)
     */
    filterUpdatesByPriority(matchId, updates, current, source) {
        const filtered = [];
        for (const update of updates) {
            // Get current field's source and priority
            const currentSource = this.getFieldSource(update.field, current);
            const currentPriority = (0, lockKeys_1.getSourcePriority)(currentSource);
            const updatePriority = update.priority ?? (0, lockKeys_1.getSourcePriority)(update.source);
            // Priority comparison
            if (updatePriority > currentPriority) {
                // Higher priority - accept
                filtered.push(update);
                if (this.config.debug) {
                    logger_1.logger.debug(`[MatchOrchestrator] ${matchId}.${update.field}: ACCEPT (priority ${updatePriority} > ${currentPriority})`);
                }
            }
            else if (updatePriority < currentPriority) {
                // Lower priority - reject
                if (this.config.debug) {
                    logger_1.logger.debug(`[MatchOrchestrator] ${matchId}.${update.field}: REJECT (priority ${updatePriority} < ${currentPriority})`);
                }
            }
            else {
                // Same priority - check timestamp
                const currentTimestamp = this.getFieldTimestamp(update.field, current);
                if (currentTimestamp === null || update.timestamp >= currentTimestamp) {
                    // Newer or same timestamp - accept
                    filtered.push(update);
                    if (this.config.debug) {
                        logger_1.logger.debug(`[MatchOrchestrator] ${matchId}.${update.field}: ACCEPT (ts ${update.timestamp} >= ${currentTimestamp})`);
                    }
                }
                else {
                    // Older timestamp - reject
                    if (this.config.debug) {
                        logger_1.logger.debug(`[MatchOrchestrator] ${matchId}.${update.field}: REJECT (ts ${update.timestamp} < ${currentTimestamp})`);
                    }
                }
            }
        }
        return filtered;
    }
    /**
     * Get the source of a field from current state
     */
    getFieldSource(field, current) {
        // Currently only status_id has dedicated source tracking
        if (field === 'status_id') {
            return current.status_id_source ?? 'unknown';
        }
        // Fall back to last_update_source for other fields
        return current.last_update_source ?? 'unknown';
    }
    /**
     * Get the timestamp of a field from current state
     */
    getFieldTimestamp(field, current) {
        // Currently only status_id has dedicated timestamp tracking
        if (field === 'status_id') {
            return current.status_id_timestamp;
        }
        // Other fields don't have dedicated timestamps
        return null;
    }
    // ============================================================
    // CONVENIENCE METHODS
    // ============================================================
    /**
     * Update match status with source tracking
     */
    async updateStatus(matchId, statusId, source, timestamp) {
        const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
        return this.updateMatch(matchId, [
            {
                field: 'status_id',
                value: statusId,
                source,
                priority: (0, lockKeys_1.getSourcePriority)(source),
                timestamp: nowTs,
            },
        ], source);
    }
    /**
     * Update match score with source tracking
     */
    async updateScore(matchId, homeScore, awayScore, source, timestamp) {
        const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
        const priority = (0, lockKeys_1.getSourcePriority)(source);
        return this.updateMatch(matchId, [
            { field: 'home_score_display', value: homeScore, source, priority, timestamp: nowTs },
            { field: 'away_score_display', value: awayScore, source, priority, timestamp: nowTs },
        ], source);
    }
    /**
     * Update match minute with source tracking
     */
    async updateMinute(matchId, minute, source, timestamp) {
        const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
        return this.updateMatch(matchId, [
            {
                field: 'minute',
                value: minute,
                source,
                priority: (0, lockKeys_1.getSourcePriority)(source),
                timestamp: nowTs,
            },
        ], source);
    }
    /**
     * Transition match to finished (status=8)
     * Includes post-finish cleanup (provider_update_time, last_event_ts)
     */
    async finishMatch(matchId, source, finalScore, timestamp) {
        const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
        const priority = (0, lockKeys_1.getSourcePriority)(source);
        const updates = [
            { field: 'status_id', value: 8, source, priority, timestamp: nowTs },
            { field: 'last_event_ts', value: nowTs, source, priority, timestamp: nowTs },
        ];
        if (finalScore) {
            updates.push({ field: 'home_score_display', value: finalScore.home, source, priority, timestamp: nowTs }, { field: 'away_score_display', value: finalScore.away, source, priority, timestamp: nowTs });
        }
        return this.updateMatch(matchId, updates, source);
    }
    /**
     * Bulk update for multiple matches
     * Each match is updated independently with its own lock
     */
    async updateMatches(matchUpdates, source) {
        const results = new Map();
        // Process in parallel (each has own lock)
        await Promise.all(matchUpdates.map(async ({ matchId, updates }) => {
            const result = await this.updateMatch(matchId, updates, source);
            results.set(matchId, result);
        }));
        return results;
    }
    // ============================================================
    // HEALTH & METRICS
    // ============================================================
    /**
     * Get orchestrator health status
     */
    getHealth() {
        return {
            initialized: true,
            config: this.config,
        };
    }
}
exports.MatchOrchestrator = MatchOrchestrator;
exports.MatchOrchestratorClass = MatchOrchestrator;
MatchOrchestrator.instance = null;
// ============================================================
// EXPORTS
// ============================================================
// Default singleton export
exports.matchOrchestrator = MatchOrchestrator.getInstance();
