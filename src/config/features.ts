/**
 * Feature Flags Configuration
 *
 * PR-P1B: N+1 Query Elimination
 * PR-P1C: Concurrency Control Framework
 * Allows gradual rollout of optimizations with instant rollback capability
 */

export const FEATURE_FLAGS = {
  // PR-P1B: N+1 Query Elimination
  USE_OPTIMIZED_DAILY_REWARDS: process.env.USE_OPTIMIZED_DAILY_REWARDS === 'true',
  USE_OPTIMIZED_BADGE_UNLOCK: process.env.USE_OPTIMIZED_BADGE_UNLOCK === 'true',
  USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS: process.env.USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS === 'true',
  USE_OPTIMIZED_PUSH_SERVICE: process.env.USE_OPTIMIZED_PUSH_SERVICE === 'true',
} as const;

/**
 * PR-P1C: Concurrency Limits
 * Controls maximum concurrent operations to prevent pool exhaustion
 * Set to Infinity to disable (revert to unbounded)
 */
export const CONCURRENCY_LIMITS = {
  // Match enricher concurrency (default: 50, recommended: 10)
  MATCH_ENRICHER: parseInt(process.env.MATCH_ENRICHER_CONCURRENCY || '50', 10),

  // Match watchdog concurrency (default: 15, recommended: 5)
  MATCH_WATCHDOG: parseInt(process.env.MATCH_WATCHDOG_CONCURRENCY || '15', 10),

  // Badge auto-unlock batch size (default: 100)
  BADGE_AUTO_UNLOCK: parseInt(process.env.BADGE_AUTO_UNLOCK_BATCH_SIZE || '100', 10),

  // General API request concurrency
  API_REQUEST_CONCURRENCY: parseInt(process.env.API_REQUEST_CONCURRENCY || '20', 10),
} as const;

/**
 * Check if all PR-P1B optimizations are enabled
 */
export function isFullyOptimized(): boolean {
  return (
    FEATURE_FLAGS.USE_OPTIMIZED_DAILY_REWARDS &&
    FEATURE_FLAGS.USE_OPTIMIZED_BADGE_UNLOCK &&
    FEATURE_FLAGS.USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS &&
    FEATURE_FLAGS.USE_OPTIMIZED_PUSH_SERVICE
  );
}

/**
 * Get optimization status summary
 */
export function getOptimizationStatus(): Record<string, boolean> {
  return {
    dailyRewards: FEATURE_FLAGS.USE_OPTIMIZED_DAILY_REWARDS,
    badgeUnlock: FEATURE_FLAGS.USE_OPTIMIZED_BADGE_UNLOCK,
    scheduledNotifications: FEATURE_FLAGS.USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS,
    pushService: FEATURE_FLAGS.USE_OPTIMIZED_PUSH_SERVICE,
  };
}
