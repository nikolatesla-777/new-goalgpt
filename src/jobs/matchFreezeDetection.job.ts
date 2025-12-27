/**
 * Match Freeze Detection Worker
 * 
 * Phase 4-3: Detects and escalates frozen/stale matches with action ladder.
 * 
 * Action Ladder:
 * - Step A: match.stale.detected (WARN) - log only
 * - Step B: match.stale.reconcile.requested (WARN) - trigger reconcile (with cooldown)
 * - Step C: match.stale.marked (ERROR) - mark as unresolved (if still stale after reconcile)
 * 
 * CRITICAL:
 * - Cooldown prevents reconcile spam (5 min cooldown per match)
 * - Deduplication prevents same match being processed twice in same window
 * - Does NOT update minute, updated_at, or status_id directly
 */

import { MatchFreezeDetectionService } from '../services/thesports/match/matchFreezeDetection.service';
import { MatchDetailLiveService } from '../services/thesports/match/matchDetailLive.service';
import { CircuitOpenError } from '../utils/circuitBreaker';
import { logger } from '../utils/logger';
import { logEvent } from '../utils/obsLogger';

export class MatchFreezeDetectionWorker {
  private freezeDetectionService: MatchFreezeDetectionService;
  private matchDetailLiveService: MatchDetailLiveService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Cooldown tracking: matchId -> last reconcile attempt timestamp (seconds)
  private reconcileCooldown: Map<string, number> = new Map();
  private cooldownSeconds: number = 300; // 5 minutes

  // Auto-end threshold: If match is stale for this long, force-end it
  // Set to 2 hours (7200 seconds) - matches stuck this long are clearly abandoned
  private autoEndThresholdSeconds: number = 7200;

  // Deduplication: matches processed in current window
  private processedInWindow: Set<string> = new Set();

  constructor(matchDetailLiveService: MatchDetailLiveService) {
    this.freezeDetectionService = new MatchFreezeDetectionService();
    this.matchDetailLiveService = matchDetailLiveService;
  }

  /**
   * Process frozen matches with action ladder
   */
  async tick(): Promise<void> {
    if (this.isRunning) {
      logger.debug('[FreezeDetection] Tick already running, skipping this run');
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    const nowTs = Math.floor(Date.now() / 1000);

    // Clear deduplication set at start of each window
    this.processedInWindow.clear();

    try {
      // Detect frozen matches
      const frozen = await this.freezeDetectionService.detectFrozenMatches(
        nowTs,
        120,  // LIVE stale: 120s
        900,  // HALF_TIME stuck: 900s (15 min)
        180   // SECOND_HALF no progress: 180s (3 min)
      );

      if (frozen.length === 0) {
        logEvent('debug', 'freeze.tick', {
          scanned_count: 0,
          frozen_count: 0,
          duration_ms: Date.now() - startedAt,
        });
        return;
      }

      logEvent('info', 'freeze.tick', {
        scanned_count: frozen.length,
        frozen_count: frozen.length,
        duration_ms: Date.now() - startedAt,
      });

      let detectedCount = 0;
      let reconcileRequestedCount = 0;
      let reconcileSkippedCooldownCount = 0;
      let reconcileSkippedCircuitOpenCount = 0;
      let reconcileDoneCount = 0;
      let reconcileFailedCount = 0;
      let markedCount = 0;

      for (const match of frozen) {
        // Deduplication: skip if already processed in this window
        if (this.processedInWindow.has(match.matchId)) {
          continue;
        }
        this.processedInWindow.add(match.matchId);

        // Step A: Log detection
        logEvent('warn', 'match.stale.detected', {
          match_id: match.matchId,
          status_id: match.statusId,
          minute: match.minute,
          last_event_ts: match.lastEventTs,
          provider_update_time: match.providerUpdateTime,
          reason: match.reason,
          threshold_sec: match.thresholdSec,
          age_sec: match.ageSec,
        });
        detectedCount++;

        // Step B: Request reconcile (with cooldown check)
        const lastReconcile = this.reconcileCooldown.get(match.matchId);
        const cooldownExpired = lastReconcile === undefined || (nowTs - lastReconcile) >= this.cooldownSeconds;

        if (!cooldownExpired) {
          const remainingCooldown = this.cooldownSeconds - (nowTs - lastReconcile);
          logEvent('debug', 'match.stale.reconcile.skipped', {
            match_id: match.matchId,
            reason: 'cooldown',
            remaining_cooldown_sec: remainingCooldown,
          });
          reconcileSkippedCooldownCount++;
          continue;
        }

        // Check if circuit breaker is open (skip reconcile if so)
        let reconcileResult: { updated: boolean; rowCount: number } | null = null;
        try {
          logEvent('warn', 'match.stale.reconcile.requested', {
            match_id: match.matchId,
            reason: match.reason,
            cooldown_state: 'expired',
          });
          reconcileRequestedCount++;

          const reconcileStart = Date.now();
          reconcileResult = await this.matchDetailLiveService.reconcileMatchToDatabase(match.matchId, null);
          const reconcileDuration = Date.now() - reconcileStart;

          // Update cooldown
          this.reconcileCooldown.set(match.matchId, nowTs);

          logEvent('info', 'match.stale.reconcile.done', {
            match_id: match.matchId,
            ok: reconcileResult.updated,
            duration_ms: reconcileDuration,
            rowCount: reconcileResult.rowCount,
          });

          if (reconcileResult.updated) {
            reconcileDoneCount++;
            // If reconcile succeeded, match may no longer be stale - skip marking
            continue;
          } else {
            reconcileFailedCount++;

            // CRITICAL FIX: If match is stale for 2+ hours and reconcile returned no data,
            // force-end the match to prevent it from being stuck forever
            if (match.ageSec >= this.autoEndThresholdSeconds) {
              try {
                const forceEnded = await this.freezeDetectionService.forceEndStaleMatch(match.matchId);
                if (forceEnded) {
                  logEvent('warn', 'match.stale.auto_ended', {
                    match_id: match.matchId,
                    reason: match.reason,
                    stale_since_sec: match.ageSec,
                    threshold_sec: this.autoEndThresholdSeconds,
                    new_status: 8,
                  });
                  continue; // Match fixed, skip marking
                }
              } catch (forceEndError: any) {
                logEvent('error', 'match.stale.force_end_failed', {
                  match_id: match.matchId,
                  error: forceEndError.message,
                });
              }
            }

            // Step C: Mark as unresolved (reconcile returned no data)
            // Note: No DB write - only structured log signal
            logEvent('error', 'match.stale.marked', {
              match_id: match.matchId,
              reason: match.reason,
              stale_since: match.ageSec,
              reconcile_attempts: 1,
              failure_reason: 'reconcile_no_data',
            });
            markedCount++;
            continue;
          }
        } catch (error: any) {
          // Circuit breaker is open - skip reconcile
          if (error instanceof CircuitOpenError) {
            logEvent('warn', 'match.stale.reconcile.skipped', {
              match_id: match.matchId,
              reason: 'circuit_open',
            });
            reconcileSkippedCircuitOpenCount++;
            continue; // Skip marking - circuit open is not a failure, just a skip
          }

          // Other errors - these trigger marking
          logEvent('error', 'match.stale.reconcile.failed', {
            match_id: match.matchId,
            error: error.message,
          });
          reconcileFailedCount++;

          // Step C: Mark as unresolved (reconcile exception, circuit_open excluded)
          // Note: No DB write - only structured log signal
          logEvent('error', 'match.stale.marked', {
            match_id: match.matchId,
            reason: match.reason,
            stale_since: match.ageSec,
            reconcile_attempts: 1,
            failure_reason: 'reconcile_exception',
          });
          markedCount++;
          continue;
        }
      }

      // Cleanup old cooldown entries (older than 1 hour)
      const oneHourAgo = nowTs - 3600;
      for (const [matchId, timestamp] of this.reconcileCooldown.entries()) {
        if (timestamp < oneHourAgo) {
          this.reconcileCooldown.delete(matchId);
        }
      }

      logEvent('info', 'freeze.tick.done', {
        detected_count: detectedCount,
        reconcile_requested_count: reconcileRequestedCount,
        reconcile_skipped_cooldown_count: reconcileSkippedCooldownCount,
        reconcile_skipped_circuit_open_count: reconcileSkippedCircuitOpenCount,
        reconcile_done_count: reconcileDoneCount,
        reconcile_failed_count: reconcileFailedCount,
        marked_count: markedCount,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error: any) {
      logEvent('error', 'freeze.tick.failed', {
        error: error.message,
      });
      logger.error('[FreezeDetection] Error in tick:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the worker
   * Runs every 30 seconds
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Match freeze detection worker already started');
      return;
    }

    // Run immediately on start
    void this.tick();

    // Then run every 30 seconds
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 30000);

    logEvent('info', 'worker.started', {
      worker: 'MatchFreezeDetectionWorker',
      interval_sec: 30,
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.reconcileCooldown.clear();
      this.processedInWindow.clear();
      logger.info('Match freeze detection worker stopped');
    }
  }
}

