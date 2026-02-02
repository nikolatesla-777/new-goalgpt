/**
 * Feature Flags Configuration
 *
 * PR-P1B: N+1 Query Elimination
 * PR-P1C: Concurrency Control
 * PR-P1D: Caching + Index Optimization
 * Allows gradual rollout of optimizations with instant rollback capability
 */

export const FEATURE_FLAGS = {
  // PR-P1B: N+1 Query Elimination
  USE_OPTIMIZED_DAILY_REWARDS: process.env.USE_OPTIMIZED_DAILY_REWARDS === 'true',
  USE_OPTIMIZED_BADGE_UNLOCK: process.env.USE_OPTIMIZED_BADGE_UNLOCK === 'true',
  USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS: process.env.USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS === 'true',
  USE_OPTIMIZED_PUSH_SERVICE: process.env.USE_OPTIMIZED_PUSH_SERVICE === 'true',

  // PR-P1D: Caching + Index Optimization
  USE_REDIS_CACHE: process.env.USE_REDIS_CACHE === 'true',
  CACHE_STANDINGS: process.env.CACHE_STANDINGS === 'true',
  CACHE_H2H: process.env.CACHE_H2H === 'true',
  CACHE_MATCH_DETAILS: process.env.CACHE_MATCH_DETAILS === 'true',
} as const;

/**
 * Concurrency Limits Configuration
 *
 * PR-P1C: Concurrency Control
 * Configurable limits for bounded concurrency operations
 */
export const CONCURRENCY_LIMITS = {
  MATCH_ENRICHER: parseInt(process.env.MATCH_ENRICHER_CONCURRENCY || '50', 10),
  MATCH_WATCHDOG: parseInt(process.env.MATCH_WATCHDOG_CONCURRENCY || '15', 10),
  BADGE_AUTO_UNLOCK: parseInt(process.env.BADGE_AUTO_UNLOCK_BATCH_SIZE || '100', 10),
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
