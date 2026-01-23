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

import { pool } from '../../../database/connection';
import { matchRepository, FieldUpdate, MatchUpdateFields } from '../../../repositories/match.repository';
import { LOCK_KEYS, getSourcePriority } from '../../../jobs/lockKeys';
import { logger } from '../../../utils/logger';
import { logEvent } from '../../../utils/obsLogger';

// ============================================================
// TYPES
// ============================================================

export interface UpdateResult {
  status: 'success' | 'rejected_locked' | 'rejected_immutable' | 'rejected_stale' | 'not_found' | 'error';
  fieldsUpdated: string[];
  reason?: string;
}

export interface OrchestratorConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Skip lock acquisition (for testing only) */
  skipLock?: boolean;
  /** Allow overwriting finished matches (admin only) */
  allowOverwriteFinished?: boolean;
}

// ============================================================
// MATCH ORCHESTRATOR CLASS
// ============================================================

export class MatchOrchestrator {
  private static instance: MatchOrchestrator | null = null;
  private config: OrchestratorConfig;

  private constructor(config: OrchestratorConfig = {}) {
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
  static getInstance(config?: OrchestratorConfig): MatchOrchestrator {
    if (!MatchOrchestrator.instance) {
      MatchOrchestrator.instance = new MatchOrchestrator(config);
    }
    return MatchOrchestrator.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
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
  async updateMatch(
    matchId: string,
    updates: FieldUpdate[],
    source: string = 'unknown'
  ): Promise<UpdateResult> {
    if (updates.length === 0) {
      return { status: 'success', fieldsUpdated: [] };
    }

    const lockKey = LOCK_KEYS.matchUpdateLock(matchId);

    // PR-8B.1: Skip update if matchId is invalid (lockKey === null)
    if (lockKey === null) {
      logger.debug(`[MatchOrchestrator] Skipping update for invalid matchId: ${matchId}`);
      return { status: 'error', fieldsUpdated: [], reason: 'Invalid matchId' };
    }

    let lockAcquired = false;
    const startTime = Date.now();

    try {
      // Step 1: Acquire advisory lock (non-blocking)
      if (!this.config.skipLock) {
        lockAcquired = await matchRepository.tryAcquireLock(lockKey);
        if (!lockAcquired) {
          if (this.config.debug) {
            logger.debug(`[MatchOrchestrator] Lock busy for match ${matchId}`);
          }
          logEvent('warn', 'orchestrator.lock_busy', { matchId, source });
          return { status: 'rejected_locked', fieldsUpdated: [], reason: 'Lock held by another process' };
        }
      }

      // Step 2: Read current state
      const current = await matchRepository.getMatchUpdateState(matchId);
      if (!current) {
        logger.warn(`[MatchOrchestrator] Match ${matchId} not found`);
        return { status: 'not_found', fieldsUpdated: [], reason: 'Match not found' };
      }

      // Step 3: Check immutability (finished matches)
      const statusUpdate = updates.find(u => u.field === 'status_id');
      if (current.status_id === 8 && statusUpdate && statusUpdate.value !== 8) {
        // Match is finished, reject any attempt to change status to non-finished
        if (!this.config.allowOverwriteFinished && source !== 'admin') {
          logger.warn(
            `[MatchOrchestrator] REJECT: Match ${matchId} is finished (status=8), ` +
            `cannot change to status=${statusUpdate.value}. Source: ${source}`
          );
          logEvent('warn', 'orchestrator.rejected_immutable', {
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
          logger.debug(`[MatchOrchestrator] No updates passed priority filter for ${matchId}`);
        }
        return { status: 'rejected_stale', fieldsUpdated: [], reason: 'Updates rejected by priority filter' };
      }

      // Step 5: Apply updates atomically
      const repoResult = await matchRepository.updateFields(matchId, filteredUpdates);

      const duration = Date.now() - startTime;
      if (repoResult.status === 'success') {
        logEvent('info', 'orchestrator.update_success', {
          matchId,
          source,
          fieldsUpdated: repoResult.fieldsUpdated,
          duration_ms: duration,
        });
      }

      // Map repository result to UpdateResult
      const statusMap: Record<string, UpdateResult['status']> = {
        success: 'success',
        not_found: 'not_found',
        error: 'error',
      };
      const mappedStatus = statusMap[repoResult.status] ?? 'error';

      return {
        status: mappedStatus,
        fieldsUpdated: repoResult.fieldsUpdated,
      };
    } catch (error: any) {
      logger.error(`[MatchOrchestrator] Error updating match ${matchId}:`, error);
      logEvent('error', 'orchestrator.update_error', {
        matchId,
        source,
        error: error.message,
      });
      return { status: 'error', fieldsUpdated: [], reason: error.message };
    } finally {
      // Step 6: ALWAYS release lock
      if (lockAcquired && !this.config.skipLock) {
        try {
          await matchRepository.releaseLock(lockKey);
        } catch (e: any) {
          logger.error(`[MatchOrchestrator] Failed to release lock for ${matchId}:`, e.message);
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
  private filterUpdatesByPriority(
    matchId: string,
    updates: FieldUpdate[],
    current: {
      status_id: number;
      status_id_source: string | null;
      status_id_timestamp: number | null;
      last_update_source: string | null;
    },
    source: string
  ): FieldUpdate[] {
    const filtered: FieldUpdate[] = [];

    for (const update of updates) {
      // Get current field's source and priority
      const currentSource = this.getFieldSource(update.field, current);
      const currentPriority = getSourcePriority(currentSource);
      const updatePriority = update.priority ?? getSourcePriority(update.source);

      // Priority comparison
      if (updatePriority > currentPriority) {
        // Higher priority - accept
        filtered.push(update);
        if (this.config.debug) {
          logger.debug(
            `[MatchOrchestrator] ${matchId}.${update.field}: ACCEPT (priority ${updatePriority} > ${currentPriority})`
          );
        }
      } else if (updatePriority < currentPriority) {
        // Lower priority - reject
        if (this.config.debug) {
          logger.debug(
            `[MatchOrchestrator] ${matchId}.${update.field}: REJECT (priority ${updatePriority} < ${currentPriority})`
          );
        }
      } else {
        // Same priority - check timestamp
        const currentTimestamp = this.getFieldTimestamp(update.field, current);
        if (currentTimestamp === null || update.timestamp >= currentTimestamp) {
          // Newer or same timestamp - accept
          filtered.push(update);
          if (this.config.debug) {
            logger.debug(
              `[MatchOrchestrator] ${matchId}.${update.field}: ACCEPT (ts ${update.timestamp} >= ${currentTimestamp})`
            );
          }
        } else {
          // Older timestamp - reject
          if (this.config.debug) {
            logger.debug(
              `[MatchOrchestrator] ${matchId}.${update.field}: REJECT (ts ${update.timestamp} < ${currentTimestamp})`
            );
          }
        }
      }
    }

    return filtered;
  }

  /**
   * Get the source of a field from current state
   */
  private getFieldSource(
    field: keyof MatchUpdateFields,
    current: { status_id_source: string | null; last_update_source: string | null }
  ): string {
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
  private getFieldTimestamp(
    field: keyof MatchUpdateFields,
    current: { status_id_timestamp: number | null }
  ): number | null {
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
  async updateStatus(
    matchId: string,
    statusId: number,
    source: string,
    timestamp?: number
  ): Promise<UpdateResult> {
    const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
    return this.updateMatch(matchId, [
      {
        field: 'status_id',
        value: statusId,
        source,
        priority: getSourcePriority(source),
        timestamp: nowTs,
      },
    ], source);
  }

  /**
   * Update match score with source tracking
   */
  async updateScore(
    matchId: string,
    homeScore: number,
    awayScore: number,
    source: string,
    timestamp?: number
  ): Promise<UpdateResult> {
    const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
    const priority = getSourcePriority(source);
    return this.updateMatch(matchId, [
      { field: 'home_score_display', value: homeScore, source, priority, timestamp: nowTs },
      { field: 'away_score_display', value: awayScore, source, priority, timestamp: nowTs },
    ], source);
  }

  /**
   * Update match minute with source tracking
   */
  async updateMinute(
    matchId: string,
    minute: number,
    source: string,
    timestamp?: number
  ): Promise<UpdateResult> {
    const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
    return this.updateMatch(matchId, [
      {
        field: 'minute',
        value: minute,
        source,
        priority: getSourcePriority(source),
        timestamp: nowTs,
      },
    ], source);
  }

  /**
   * Transition match to finished (status=8)
   * Includes post-finish cleanup (provider_update_time, last_event_ts)
   */
  async finishMatch(
    matchId: string,
    source: string,
    finalScore?: { home: number; away: number },
    timestamp?: number
  ): Promise<UpdateResult> {
    const nowTs = timestamp ?? Math.floor(Date.now() / 1000);
    const priority = getSourcePriority(source);

    const updates: FieldUpdate[] = [
      { field: 'status_id', value: 8, source, priority, timestamp: nowTs },
      { field: 'last_event_ts', value: nowTs, source, priority, timestamp: nowTs },
    ];

    if (finalScore) {
      updates.push(
        { field: 'home_score_display', value: finalScore.home, source, priority, timestamp: nowTs },
        { field: 'away_score_display', value: finalScore.away, source, priority, timestamp: nowTs }
      );
    }

    return this.updateMatch(matchId, updates, source);
  }

  /**
   * Bulk update for multiple matches
   * Each match is updated independently with its own lock
   */
  async updateMatches(
    matchUpdates: Array<{ matchId: string; updates: FieldUpdate[] }>,
    source: string
  ): Promise<Map<string, UpdateResult>> {
    const results = new Map<string, UpdateResult>();

    // Process in parallel (each has own lock)
    await Promise.all(
      matchUpdates.map(async ({ matchId, updates }) => {
        const result = await this.updateMatch(matchId, updates, source);
        results.set(matchId, result);
      })
    );

    return results;
  }

  // ============================================================
  // HEALTH & METRICS
  // ============================================================

  /**
   * Get orchestrator health status
   */
  getHealth(): {
    initialized: boolean;
    config: OrchestratorConfig;
  } {
    return {
      initialized: true,
      config: this.config,
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

// Default singleton export
export const matchOrchestrator = MatchOrchestrator.getInstance();

// Class export for testing
export { MatchOrchestrator as MatchOrchestratorClass };
