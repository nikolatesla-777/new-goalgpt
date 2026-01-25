/**
 * Advisory Lock Key Registry
 *
 * PR-6: Match Orchestrator
 *
 * Centralized registry for PostgreSQL advisory lock keys.
 * All jobs MUST use these keys instead of hardcoded values.
 *
 * PostgreSQL advisory locks use bigint keys (64-bit).
 * We partition the key space to avoid collisions:
 *
 * - 910_000_000_xxx: Job-level locks (global, one per job)
 * - 920_000_000_xxx: Match-level locks (per-match, using external_id suffix)
 *
 * Usage:
 *   import { LOCK_KEYS } from './lockKeys';
 *   await pool.query('SELECT pg_try_advisory_lock($1)', [LOCK_KEYS.MATCH_WATCHDOG.toString()]);
 */

export const LOCK_KEYS = {
  // ============================================================
  // JOB-LEVEL LOCKS (910_000_000_xxx range)
  // These prevent the same job from running concurrently across instances
  // ============================================================

  /** Match watchdog job - detects stale/stuck live matches */
  MATCH_WATCHDOG: 910000000001n,

  /** Match sync job - syncs match data from TheSports API */
  MATCH_SYNC: 910000000002n,

  /** Data update job - processes /data/update endpoint */
  DATA_UPDATE: 910000000003n,

  /** Prediction settlement job - settles predictions after match ends */
  PREDICTION_SETTLEMENT: 910000000004n,

  /** Daily match sync - imports tomorrow's matches */
  DAILY_MATCH_SYNC: 910000000005n,

  /** Team data sync - syncs team information */
  TEAM_DATA_SYNC: 910000000006n,

  /** H2H pre-sync - pre-fetches head-to-head data */
  H2H_PRESYNC: 910000000007n,

  /** Lineup pre-sync - pre-fetches lineup data */
  LINEUP_PRESYNC: 910000000008n,

  /** Badge auto-unlock - automatically unlocks badges for users */
  BADGE_AUTO_UNLOCK: 910000000009n,

  /** Daily reward reminder - sends push notifications */
  DAILY_REWARD_REMINDER: 910000000010n,

  /** Match data sync - syncs match statistics */
  MATCH_DATA_SYNC: 910000000011n,

  /** Stats sync - syncs player/team statistics */
  STATS_SYNC: 910000000012n,

  /** Entity sync - syncs teams/competitions/players */
  ENTITY_SYNC: 910000000013n,

  /** Daily diary sync - syncs daily match diary */
  DAILY_DIARY_SYNC: 910000000014n,

  /** Cold start kickoff - initial data load on server start */
  COLD_START_KICKOFF: 910000000015n,

  /** Partner analytics - generates partner reports */
  PARTNER_ANALYTICS: 910000000016n,

  /** Referral tier 2 processing */
  REFERRAL_TIER_2: 910000000017n,

  /** Referral tier 3 processing */
  REFERRAL_TIER_3: 910000000018n,

  /** Dead token cleanup - removes expired push tokens */
  DEAD_TOKEN_CLEANUP: 910000000019n,

  /** Old logs cleanup - removes old log entries */
  OLD_LOGS_CLEANUP: 910000000020n,

  /** Scheduled notifications - sends scheduled push notifications */
  SCHEDULED_NOTIFICATIONS: 910000000021n,

  /** Subscription expiry alerts - alerts users about expiring subscriptions */
  SUBSCRIPTION_EXPIRY_ALERTS: 910000000022n,

  /** Streak break warnings - warns users about breaking streaks */
  STREAK_BREAK_WARNINGS: 910000000023n,

  /** Team logo sync - syncs team logo images */
  TEAM_LOGO_SYNC: 910000000024n,

  /** Data completeness validator - validates data integrity */
  DATA_COMPLETENESS_VALIDATOR: 910000000025n,

  /** Match minute job - updates match minutes */
  MATCH_MINUTE: 910000000026n,

  /** Telegram settlement job - settles published telegram picks */
  TELEGRAM_SETTLEMENT: 910000000027n,

  /** Telegram daily lists job - publishes daily prediction lists */
  TELEGRAM_DAILY_LISTS: 910000000028n,

  // ============================================================
  // MATCH-LEVEL LOCKS (920_000_000_xxx + match_id)
  // These prevent concurrent updates to the same match
  // ============================================================

  /**
   * Generate a match-level lock key for atomic match updates.
   *
   * PR-8B.1: Support alphanumeric matchIds (TheSports API format)
   * Uses deterministic hash for string matchIds
   *
   * @param matchId - The external_id of the match (alphanumeric or numeric)
   * @returns bigint lock key unique to this match, or null for invalid IDs
   *
   * @example
   * const lockKey = LOCK_KEYS.matchUpdateLock("l7oqdehg6ko3r51");
   * // Returns: 920000000000n + hash("l7oqdehg6ko3r51")
   *
   * Note: Returns null for invalid/empty matchIds (caller should skip)
   */
  matchUpdateLock: (matchId: number | string): bigint | null => {
    // PR-8B.1: Skip invalid/empty matchIds (don't throw error)
    if (!matchId || matchId === '') {
      return null;
    }

    const matchIdStr = String(matchId);

    // PR-8B.1: Generate deterministic 63-bit hash for alphanumeric matchIds
    // Uses polynomial rolling hash (DJB2 variant) for deterministic collision-resistant hashing
    let hash = 5381n; // DJB2 initial value
    for (let i = 0; i < matchIdStr.length; i++) {
      const charCode = BigInt(matchIdStr.charCodeAt(i));
      hash = ((hash << 5n) + hash) + charCode; // hash * 33 + c
    }

    // Ensure positive 63-bit value using BigInt.asUintN (safe and efficient)
    // This guarantees: 0 <= safeHash <= 2^63-1 (PostgreSQL bigint max)
    const safeHash = BigInt.asUintN(63, hash);

    // Modulo to fit within safe range: 0 to 999_999_999_999 (1 trillion)
    // This gives us 920_000_000_000 to 920_999_999_999 range for lock keys
    const MATCH_UPDATE_BASE = 920_000_000_000n;
    const MAX_HASH_RANGE = 999_999_999_999n;
    return MATCH_UPDATE_BASE + (safeHash % MAX_HASH_RANGE);
  },
} as const;

/**
 * Source priority for match updates.
 * Higher number = higher priority.
 * When two sources try to update the same field, higher priority wins.
 *
 * Priority order (highest to lowest):
 * 1. admin (10) - Manual admin corrections always win
 * 2. watchdog (3) - Real-time recovery has high priority
 * 3. api (2) - Direct API responses are trusted
 * 4. sync (2) - Sync jobs are at same level as API
 * 5. computed (1) - Computed values (minute calculation) are lowest
 * 6. dataUpdate (1) - Bulk data updates are lowest
 */
export const SOURCE_PRIORITY: Record<string, number> = {
  admin: 10,      // Manual admin override - highest priority
  watchdog: 3,    // Real-time recovery - high priority
  api: 2,         // Direct API response - medium priority
  sync: 2,        // Sync job - same as API
  computed: 1,    // Computed values - low priority
  dataUpdate: 1,  // Bulk data updates - low priority
  unknown: 0,     // Unknown source - lowest priority
} as const;

/**
 * Get priority for a given source.
 *
 * @param source - The source name
 * @returns Priority number (0 if unknown)
 */
export function getSourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? SOURCE_PRIORITY.unknown;
}

export type LockKeyName = keyof typeof LOCK_KEYS;
export type SourceName = keyof typeof SOURCE_PRIORITY;
