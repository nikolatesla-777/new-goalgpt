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

import { EventEmitter } from 'events';
import { RedisManager } from '../../core/RedisManager';
import { pool } from '../../database/connection';
import { logger } from '../../utils/logger';
import { logEvent } from '../../utils/obsLogger';

/**
 * Field update from a data source
 */
export interface FieldUpdate {
  field: string;
  value: any;
  source: 'api' | 'mqtt' | 'computed' | 'watchdog';
  priority: number;
  timestamp: number;
}

/**
 * Match update result
 */
export interface UpdateResult {
  status: 'success' | 'retry' | 'rejected';
  reason?: string;
  fieldsUpdated?: string[];
}

/**
 * Current match state from database
 */
interface MatchState {
  external_id: string;
  [key: string]: any; // All match fields
}

/**
 * Field ownership and conflict resolution rules
 */
interface FieldRules {
  source?: 'api' | 'mqtt' | 'computed' | 'watchdog'; // Preferred source
  fallback?: 'api' | 'mqtt' | 'computed' | 'watchdog'; // Fallback source
  writeOnce?: boolean; // Once set, never overwrite
  nullable?: boolean; // Can be NULL
  allowWatchdog?: boolean; // Allow watchdog to force-update (for anomaly recovery)
}

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
export class LiveMatchOrchestrator extends EventEmitter {
  private static instance: LiveMatchOrchestrator | null = null;

  // Fields that have _source and _timestamp metadata columns in database
  // Maps field name → metadata column prefix
  // (from add-field-metadata.ts migration)
  private readonly fieldMetadataMap: Record<string, string> = {
    'home_score_display': 'home_score',      // home_score_source, home_score_timestamp
    'away_score_display': 'away_score',      // away_score_source, away_score_timestamp
    'minute': 'minute',                       // minute_source, minute_timestamp
    'status_id': 'status_id',                // status_id_source, status_id_timestamp
  };

  // Field ownership rules
  private readonly fieldRules: Record<string, FieldRules> = {
    // Score fields: MQTT preferred (real-time), API fallback
    home_score_display: { source: 'mqtt', fallback: 'api', nullable: true },
    away_score_display: { source: 'mqtt', fallback: 'api', nullable: true },

    // Status: API preferred (authoritative), MQTT fallback, watchdog can force-update for anomaly recovery
    status_id: { source: 'api', fallback: 'mqtt', allowWatchdog: true },

    // Minute: API preferred, computed fallback
    minute: { source: 'api', fallback: 'computed', nullable: true },

    // Critical timestamps: Write-once (never overwrite)
    second_half_kickoff_ts: { writeOnce: true, nullable: true },
    overtime_kickoff_ts: { writeOnce: true, nullable: true },

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

  private constructor() {
    super();
    logger.info('[Orchestrator] LiveMatchOrchestrator initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): LiveMatchOrchestrator {
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
  async updateMatch(
    matchId: string,
    updates: FieldUpdate[],
    source: string
  ): Promise<UpdateResult> {
    const lockKey = `lock:match:${matchId}`;
    const lockTTL = 5; // 5 seconds

    try {
      // Step 1: Acquire distributed lock
      const lockAcquired = await RedisManager.acquireLock(lockKey, source, lockTTL);

      if (!lockAcquired) {
        // Another job is writing - retry later
        logEvent('warn', 'orchestrator.lock_failed', {
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
        logEvent('error', 'orchestrator.match_not_found', { matchId, source });
        await RedisManager.releaseLock(lockKey);

        return {
          status: 'rejected',
          reason: 'Match not found in database',
        };
      }

      // Step 3: Apply conflict resolution
      const resolvedUpdates = this.resolveConflicts(currentState, updates);

      if (Object.keys(resolvedUpdates).length === 0) {
        // All updates rejected by conflict resolution
        logEvent('info', 'orchestrator.no_updates', {
          matchId,
          source,
          reason: 'All updates rejected by conflict resolution',
        });

        await RedisManager.releaseLock(lockKey);

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

      logEvent('info', 'orchestrator.update_success', {
        matchId,
        source,
        fieldsUpdated,
      });

      // Step 6: Release lock
      await RedisManager.releaseLock(lockKey);

      return {
        status: 'success',
        fieldsUpdated,
      };
    } catch (error: any) {
      logger.error(`[Orchestrator] Error updating match ${matchId}:`, error);

      // Ensure lock is released on error
      await RedisManager.releaseLock(lockKey).catch(() => {
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
  private async writeToDatabase(matchId: string, updates: Record<string, any>): Promise<void> {
    if (Object.keys(updates).length === 0) {
      return;
    }

    const client = await pool.connect();
    try {
      // Build SET clause dynamically
      const setClause: string[] = [];
      const values: any[] = [];
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

      logger.debug(`[Orchestrator] Wrote ${Object.keys(updates).length} fields to DB for ${matchId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Fetch current match state from database
   */
  private async fetchCurrentState(matchId: string): Promise<MatchState | null> {
    const client = await pool.connect();
    try {
      const query = `
        SELECT
          external_id,
          home_score_display,
          away_score_display,
          status_id,
          minute,
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
    } finally {
      client.release();
    }
  }

  /**
   * Conflict resolution - which updates should be applied?
   *
   * Rules:
   * 1. Write-once fields: Never overwrite if already set
   * 2. Source priority: Preferred source wins over others
   * 3. Timestamp: Newer timestamp wins (optimistic locking)
   * 4. NULL handling: Respect nullable rules
   */
  private resolveConflicts(
    currentState: MatchState,
    updates: FieldUpdate[]
  ): Record<string, any> {
    const resolved: Record<string, any> = {};

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
        logEvent('debug', 'orchestrator.write_once_skip', {
          matchId: currentState.external_id,
          field: fieldName,
          reason: 'Field is write-once and already set',
        });
        continue; // Skip - already set
      }

      // Rule 2: Source priority
      if (rules?.source) {
        // SPECIAL CASE: Watchdog can force-update certain fields for anomaly recovery
        if (update.source === 'watchdog' && rules.allowWatchdog) {
          logEvent('debug', 'orchestrator.watchdog_override', {
            matchId: currentState.external_id,
            field: fieldName,
            reason: 'Watchdog force-update for anomaly recovery',
          });
          // Allow watchdog to update - skip other source checks
        } else {
          // Normal source priority logic
          // If current value exists and comes from preferred source
          if (currentValue !== null && currentSource === rules.source) {
            // Incoming update is NOT from preferred source → reject
            if (update.source !== rules.source) {
              logEvent('debug', 'orchestrator.source_priority_skip', {
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
            } else if (update.source === rules.fallback && currentValue === null) {
              // Allow - fallback when NULL
            } else {
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
          logEvent('debug', 'orchestrator.stale_timestamp', {
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
        logEvent('warn', 'orchestrator.null_rejected', {
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
  async calculateMinute(matchId: string, matchData: any): Promise<FieldUpdate | null> {
    const { status_id, match_time, second_half_kickoff_ts, overtime_kickoff_ts } = matchData;

    // Only calculate for live-like statuses
    if (![2, 4, 5, 7].includes(status_id)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    let minute: number | null = null;

    try {
      if (status_id === 2) {
        // FIRST_HALF: Elapsed time from match_time
        const elapsed = now - match_time;
        minute = Math.floor(elapsed / 60);

        // Sanity check: max 60 minutes for first half
        if (minute > 60) minute = 60;
      } else if (status_id === 4) {
        // SECOND_HALF: Elapsed time from second_half_kickoff_ts
        if (second_half_kickoff_ts) {
          const elapsed = now - second_half_kickoff_ts;
          minute = 45 + Math.floor(elapsed / 60);

          // Sanity check: max 105 minutes total
          if (minute > 105) minute = 105;
        } else {
          // Fallback: assume halftime is 15 minutes
          const elapsed = now - match_time;
          const secondHalfElapsed = elapsed - 2700; // 45min * 60s
          minute = 45 + Math.floor(secondHalfElapsed / 60);

          if (minute < 45) minute = 45; // At least 45
          if (minute > 105) minute = 105;
        }
      } else if (status_id === 5) {
        // OVERTIME: Elapsed time from overtime_kickoff_ts
        if (overtime_kickoff_ts) {
          const elapsed = now - overtime_kickoff_ts;
          minute = 90 + Math.floor(elapsed / 60);

          // Sanity check: max 130 minutes total
          if (minute > 130) minute = 130;
        } else {
          // Fallback
          minute = 90;
        }
      } else if (status_id === 7) {
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
    } catch (error: any) {
      logger.error(`[Orchestrator] Error calculating minute for ${matchId}:`, error);
      return null;
    }
  }

  /**
   * Health check - verify orchestrator is operational
   */
  async healthCheck(): Promise<{ healthy: boolean; redis: boolean }> {
    const redisHealthy = await RedisManager.healthCheck();

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
      redisStats: RedisManager.getStats(),
      eventListeners: this.eventNames().map((name) => ({
        event: name,
        listeners: this.listenerCount(name),
      })),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('[Orchestrator] Shutting down...');
    this.removeAllListeners();
    await RedisManager.close();
    logger.info('[Orchestrator] Shutdown complete');
  }
}
