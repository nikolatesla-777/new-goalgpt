/**
 * Feature Flags Configuration
 *
 * PR-P1B: N+1 Query Elimination
 * Allows gradual rollout of query optimizations with instant rollback capability
 */

export const FEATURE_FLAGS = {
  // PR-P1B: N+1 Query Elimination
  USE_OPTIMIZED_DAILY_REWARDS: process.env.USE_OPTIMIZED_DAILY_REWARDS === 'true',
  USE_OPTIMIZED_BADGE_UNLOCK: process.env.USE_OPTIMIZED_BADGE_UNLOCK === 'true',
  USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS: process.env.USE_OPTIMIZED_SCHEDULED_NOTIFICATIONS === 'true',
  USE_OPTIMIZED_PUSH_SERVICE: process.env.USE_OPTIMIZED_PUSH_SERVICE === 'true',
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
