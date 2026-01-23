"use strict";
/**
 * Live Match Orchestrator
 *
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for all live match data writes.
 * All jobs (matchSync, dataUpdate, matchMinute, watchdog) MUST go through this orchestrator.
 *
 * Features:
 * - Field-level distributed locking (Redis)
 * - Conflict resolution with priority rules
 * - Write-once field protection
 * - Optimistic locking with timestamps
 * - Batched writes with deduplication
 * - Event-driven notifications
 *
 * @module services/orchestration/LiveMatchOrchestrator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveMatchOrchestrator = void 0;
const events_1 = require("events");
const RedisManager_1 = require("../../core/RedisManager");
const connection_1 = require("../../database/connection");
const logger_1 = require("../../utils/logger");
const obsLogger_1 = require("../../utils/obsLogger");
/**
 * LiveMatchOrchestrator - Single authority for all live match writes
 *
 * USAGE:
 * ```typescript
 * const orchestrator = LiveMatchOrchestrator.getInstance();
 *
 * // Job sends updates to orchestrator
 * await orchestrator.updateMatch('match-123', [
 *   { field: 'home_score_display', value: 2, source: 'mqtt', priority: 2, timestamp: Date.now() }
 * ], 'dataUpdate');
 * ```
 */
class LiveMatchOrchestrator extends events_1.EventEmitter {
    constructor() {
        super();
        // Fields that have _source and _timestamp metadata columns in database
        // Maps field name → metadata column prefix
        // (from add-field-metadata.ts migration)
        this.fieldMetadataMap = {
            'home_score_display': 'home_score', // home_score_source, home_score_timestamp
            'away_score_display': 'away_score', // away_score_source, away_score_timestamp
            'minute': 'minute', // minute_source, minute_timestamp
            'status_id': 'status_id', // status_id_source, status_id_timestamp
        };
        // Field ownership rules
        this.fieldRules = {
            // Score fields: MQTT preferred (real-time), API fallback
            home_score_display: { source: 'mqtt', fallback: 'api', nullable: true },
            away_score_display: { source: 'mqtt', fallback: 'api', nullable: true },
            // Status: API preferred (authoritative), MQTT fallback, watchdog can force-update for anomaly recovery
            status_id: { source: 'api', fallback: 'mqtt', allowWatchdog: true },
            // Minute: CRITICAL FIX - computed preferred (per TheSports docs: calculate from kickoff)
            // API minute can be stale/delayed, causing minute to jump backwards
            minute: { source: 'computed', fallback: 'api', nullable: true },
            // Critical timestamps: Write-once (never overwrite once set)
            // Source: 'api' ensures we trust the provider's timestamp when it arrives
            first_half_kickoff_ts: { source: 'api', writeOnce: true, nullable: true },
            second_half_kickoff_ts: { source: 'api', writeOnce: true, nullable: true },
            overtime_kickoff_ts: { source: 'api', writeOnce: true, nullable: true },
            // Provider data: API only, watchdog can update last_event_ts for anomaly recovery
            provider_update_time: { source: 'api', nullable: true },
            last_event_ts: { source: 'api', nullable: true, allowWatchdog: true },
            // Match metadata: API only
            match_time: { source: 'api' },
            home_team_id: { source: 'api' },
            away_team_id: { source: 'api' },
            competition_id: { source: 'api' },
            season_id: { source: 'api' },
            // Computed fields: Computed source only
            last_minute_update_ts: { source: 'computed', nullable: true },
            // Match data sync fields: API only (background persistence)
            trend_data: { source: 'api', nullable: true },
        };
        logger_1.logger.info('[Orchestrator] LiveMatchOrchestrator initialized');
    }
    /**
     * Get singleton instance
     */
    static getInstance() {
        if (!this.instance) {
            this.instance = new LiveMatchOrchestrator();
        }
        return this.instance;
    }
    /**
     * Main entry point - all match writes go through here
     *
     * @param matchId - External match ID
     * @param updates - Array of field updates
     * @param source - Source job name (for logging/debugging)
     * @returns Update result
     */
    async updateMatch(matchId, updates, source) {
        const lockKey = `lock:match:${matchId}`;
        const lockTTL = 5; // 5 seconds
        try {
            // Step 1: Acquire distributed lock
            const lockAcquired = await RedisManager_1.RedisManager.acquireLock(lockKey, source, lockTTL);
            if (!lockAcquired) {
                // Another job is writing - retry later
                (0, obsLogger_1.logEvent)('warn', 'orchestrator.lock_failed', {
                    matchId,
                    source,
                    reason: 'lock_busy',
                });
                // Emit retry event
                this.emit('match:update:retry', { matchId, updates, source });
                return {
                    status: 'retry',
                    reason: 'Lock busy - another job is writing to this match',
                };
            }
            // Step 2: Fetch current match state
            const currentState = await this.fetchCurrentState(matchId);
            if (!currentState) {
                // Match not found in database
                (0, obsLogger_1.logEvent)('error', 'orchestrator.match_not_found', { matchId, source });
                await RedisManager_1.RedisManager.releaseLock(lockKey);
                return {
                    status: 'rejected',
                    reason: 'Match not found in database',
                };
            }
            // Step 3: Apply conflict resolution
            const resolvedUpdates = this.resolveConflicts(currentState, updates);
            if (Object.keys(resolvedUpdates).length === 0) {
                // All updates rejected by conflict resolution
                (0, obsLogger_1.logEvent)('info', 'orchestrator.no_updates', {
                    matchId,
                    source,
                    reason: 'All updates rejected by conflict resolution',
                });
                await RedisManager_1.RedisManager.releaseLock(lockKey);
                return {
                    status: 'rejected',
                    reason: 'All updates rejected by conflict resolution rules',
                };
            }
            // Step 4: Write to database
            await this.writeToDatabase(matchId, resolvedUpdates);
            // Step 5: Emit success event
            const fieldsUpdated = Object.keys(resolvedUpdates).filter(f => !f.endsWith('_source') && !f.endsWith('_timestamp'));
            this.emit('match:updated', { matchId, fields: fieldsUpdated, source });
            (0, obsLogger_1.logEvent)('info', 'orchestrator.update_success', {
                matchId,
                source,
                fieldsUpdated,
            });
            // Step 6: Release lock
            await RedisManager_1.RedisManager.releaseLock(lockKey);
            return {
                status: 'success',
                fieldsUpdated,
            };
        }
        catch (error) {
            logger_1.logger.error(`[Orchestrator] Error updating match ${matchId}:`, error);
            // Ensure lock is released on error
            await RedisManager_1.RedisManager.releaseLock(lockKey).catch(() => {
                // Ignore release error (lock will expire)
            });
            return {
                status: 'rejected',
                reason: `Internal error: ${error.message}`,
            };
        }
    }
    /**
     * Write resolved updates to database
     */
    async writeToDatabase(matchId, updates) {
        if (Object.keys(updates).length === 0) {
            return;
        }
        const client = await connection_1.pool.connect();
        try {
            // Build SET clause dynamically
            const setClause = [];
            const values = [];
            let paramIndex = 1;
            for (const [field, value] of Object.entries(updates)) {
                setClause.push(`${field} = $${paramIndex}`);
                values.push(value);
                paramIndex++;
            }
            // Always update updated_at
            setClause.push('updated_at = NOW()');
            // Add matchId as final parameter
            values.push(matchId);
            const query = `
        UPDATE ts_matches
        SET ${setClause.join(', ')}
        WHERE external_id = $${paramIndex}
      `;
            await client.query(query, values);
            logger_1.logger.debug(`[Orchestrator] Wrote ${Object.keys(updates).length} fields to DB for ${matchId}`);
        }
        finally {
            client.release();
        }
    }
    /**
     * Fetch current match state from database
     */
    async fetchCurrentState(matchId) {
        const client = await connection_1.pool.connect();
        try {
            const query = `
        SELECT
          external_id,
          home_score_display,
          away_score_display,
          status_id,
          minute,
          first_half_kickoff_ts,
          second_half_kickoff_ts,
          overtime_kickoff_ts,
          provider_update_time,
          last_event_ts,
          match_time,
          home_team_id,
          away_team_id,
          competition_id,
          season_id,
          last_minute_update_ts,
          home_score_source,
          home_score_timestamp,
          away_score_source,
          away_score_timestamp,
          minute_source,
          minute_timestamp,
          status_id_source,
          status_id_timestamp,
          updated_at
        FROM ts_matches
        WHERE external_id = $1
      `;
            const result = await client.query(query, [matchId]);
            if (result.rows.length === 0) {
                return null;
            }
            return result.rows[0];
        }
        finally {
            client.release();
        }
    }
    /**
     * Check if status is terminal (Finished, Cancelled, etc.)
     * Terminal statuses: 8 (FT), 9 (Kickoff), 10 (Pause), 11 (Deleted), 12 (TBD)
     * TheSports API docs:
     * 8: Finished
     * 9: Delayed
     * 10: Postponed
     * 11: Cut (Interrupted?)
     * 12: Cancelled
     */
    isTerminalStatus(statusId) {
        // 8=Finished, 9=Delayed, 10=Postponed, 11=Cut, 12=Cancelled, 13=Abandoned?
        return [8, 9, 10, 11, 12, 13].includes(statusId);
    }
    /**
     * Conflict resolution - which updates should be applied?
     *
     * Rules:
     * 1. Write-once fields: Never overwrite if already set
     * 2. Terminal State Protection: Matches cannot revert from Finished -> Live
     * 3. Source priority: Preferred source wins over others
     * 4. Timestamp: Newer timestamp wins (optimistic locking)
     * 5. NULL handling: Respect nullable rules
     */
    resolveConflicts(currentState, updates) {
        const resolved = {};
        for (const update of updates) {
            const fieldName = update.field;
            const rules = this.fieldRules[fieldName];
            const currentValue = currentState[fieldName];
            // Get metadata column prefix (e.g., home_score_display → home_score)
            const metadataPrefix = this.fieldMetadataMap[fieldName] || fieldName;
            const currentSource = currentState[`${metadataPrefix}_source`];
            const currentTimestamp = currentState[`${metadataPrefix}_timestamp`];
            // Rule 1: Write-once fields (e.g., second_half_kickoff_ts)
            if (rules?.writeOnce && currentValue !== null) {
                (0, obsLogger_1.logEvent)('debug', 'orchestrator.write_once_skip', {
                    matchId: currentState.external_id,
                    field: fieldName,
                    reason: 'Field is write-once and already set',
                });
                continue; // Skip - already set
            }
            // Rule 2: Terminal State Protection (Status Guard)
            // IF current status is Terminal (e.g. 8 Finished)
            // AND incoming status is NOT Terminal (e.g. 2 Live or 1 Not Started)
            // THEN REJECT the update immediately.
            if (fieldName === 'status_id' && currentState.status_id !== null) {
                if (this.isTerminalStatus(currentState.status_id) && !this.isTerminalStatus(update.value)) {
                    (0, obsLogger_1.logEvent)('warn', 'orchestrator.terminal_state_protected', {
                        matchId: currentState.external_id,
                        currentStatus: currentState.status_id,
                        incomingStatus: update.value,
                        source: update.source,
                        reason: 'Cannot revert from terminal status to non-terminal',
                    });
                    continue; // REJECT
                }
            }
            // Rule 3: Source priority
            if (rules?.source) {
                // SPECIAL CASE: Watchdog can force-update certain fields for anomaly recovery
                if (update.source === 'watchdog' && rules.allowWatchdog) {
                    (0, obsLogger_1.logEvent)('debug', 'orchestrator.watchdog_override', {
                        matchId: currentState.external_id,
                        field: fieldName,
                        reason: 'Watchdog force-update for anomaly recovery',
                    });
                    // Allow watchdog to update - skip other source checks
                }
                else {
                    // Normal source priority logic
                    // If current value exists and comes from preferred source
                    if (currentValue !== null && currentSource === rules.source) {
                        // Incoming update is NOT from preferred source → reject
                        if (update.source !== rules.source) {
                            (0, obsLogger_1.logEvent)('debug', 'orchestrator.source_priority_skip', {
                                matchId: currentState.external_id,
                                field: fieldName,
                                currentSource,
                                incomingSource: update.source,
                                preferredSource: rules.source,
                            });
                            continue;
                        }
                    }
                    // If current value is NULL or from fallback source
                    if (currentValue === null || currentSource === rules.fallback) {
                        // Accept if incoming is from preferred source
                        if (update.source === rules.source) {
                            // Allow - preferred source wins
                        }
                        else if (update.source === rules.fallback) {
                            // CRITICAL FIX: Allow fallback to UPDATE itself!
                            // If field is already from fallback source, new fallback updates should be accepted
                            // Example: minute source='computed', new computed update with higher value should update
                            // Allow - fallback can update fallback
                        }
                        else {
                            // Reject - wrong source
                            continue;
                        }
                    }
                }
            }
            // Rule 3: Timestamp check (optimistic locking)
            // CRITICAL FIX: Only reject if BOTH timestamp is older AND value is the same
            // If value changed, we should accept the update regardless of timestamp
            // TheSports API sometimes returns older timestamps for newer data
            if (currentTimestamp && update.timestamp) {
                if (update.timestamp <= currentTimestamp && currentValue === update.value) {
                    (0, obsLogger_1.logEvent)('debug', 'orchestrator.stale_timestamp', {
                        matchId: currentState.external_id,
                        field: fieldName,
                        currentTimestamp,
                        incomingTimestamp: update.timestamp,
                    });
                    continue; // Stale AND same value - skip
                }
            }
            // Rule 4: NULL handling
            if (update.value === null && rules?.nullable === false) {
                (0, obsLogger_1.logEvent)('warn', 'orchestrator.null_rejected', {
                    matchId: currentState.external_id,
                    field: fieldName,
                    reason: 'Field is not nullable',
                });
                continue; // Reject NULL for non-nullable fields
            }
            // Accept update
            resolved[fieldName] = update.value;
            // Add metadata columns if field has them in database
            if (this.fieldMetadataMap[fieldName]) {
                const metadataPrefix = this.fieldMetadataMap[fieldName];
                resolved[`${metadataPrefix}_source`] = update.source;
                resolved[`${metadataPrefix}_timestamp`] = update.timestamp;
            }
        }
        return resolved;
    }
    /**
     * Calculate minute from match data (same logic as matchMinute.job.ts)
     *
     * @param matchId - External match ID
     * @param matchData - Current match data
     * @returns FieldUpdate or null if cannot calculate
     */
    async calculateMinute(matchId, matchData) {
        const { status_id, match_time, second_half_kickoff_ts, overtime_kickoff_ts } = matchData;
        // Only calculate for live-like statuses
        if (![2, 4, 5, 7].includes(status_id)) {
            return null;
        }
        const now = Math.floor(Date.now() / 1000);
        let minute = null;
        try {
            if (status_id === 2) {
                // FIRST_HALF: Elapsed time from match_time
                const elapsed = now - match_time;
                minute = Math.floor(elapsed / 60);
                // Sanity check: max 60 minutes for first half
                if (minute > 60)
                    minute = 60;
            }
            else if (status_id === 4) {
                // SECOND_HALF: Elapsed time from second_half_kickoff_ts
                if (second_half_kickoff_ts) {
                    const elapsed = now - second_half_kickoff_ts;
                    minute = 45 + Math.floor(elapsed / 60);
                    // Sanity check: max 105 minutes total
                    if (minute > 105)
                        minute = 105;
                }
                else {
                    // Fallback: assume halftime is 15 minutes
                    const elapsed = now - match_time;
                    const secondHalfElapsed = elapsed - 2700; // 45min * 60s
                    minute = 45 + Math.floor(secondHalfElapsed / 60);
                    if (minute < 45)
                        minute = 45; // At least 45
                    if (minute > 105)
                        minute = 105;
                }
            }
            else if (status_id === 5) {
                // OVERTIME: Elapsed time from overtime_kickoff_ts
                if (overtime_kickoff_ts) {
                    const elapsed = now - overtime_kickoff_ts;
                    minute = 90 + Math.floor(elapsed / 60);
                    // Sanity check: max 130 minutes total
                    if (minute > 130)
                        minute = 130;
                }
                else {
                    // Fallback
                    minute = 90;
                }
            }
            else if (status_id === 7) {
                // PENALTY: Fixed at 120 minutes
                minute = 120;
            }
            if (minute === null || minute < 0) {
                return null;
            }
            return {
                field: 'minute',
                value: minute,
                source: 'computed',
                priority: 1,
                timestamp: now,
            };
        }
        catch (error) {
            logger_1.logger.error(`[Orchestrator] Error calculating minute for ${matchId}:`, error);
            return null;
        }
    }
    /**
     * Health check - verify orchestrator is operational
     */
    async healthCheck() {
        const redisHealthy = await RedisManager_1.RedisManager.healthCheck();
        return {
            healthy: redisHealthy,
            redis: redisHealthy,
        };
    }
    /**
     * Get statistics
     */
    getStats() {
        return {
            redisStats: RedisManager_1.RedisManager.getStats(),
            eventListeners: this.eventNames().map((name) => ({
                event: name,
                listeners: this.listenerCount(name),
            })),
        };
    }
    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger_1.logger.info('[Orchestrator] Shutting down...');
        this.removeAllListeners();
        await RedisManager_1.RedisManager.close();
        logger_1.logger.info('[Orchestrator] Shutdown complete');
    }
}
exports.LiveMatchOrchestrator = LiveMatchOrchestrator;
LiveMatchOrchestrator.instance = null;
