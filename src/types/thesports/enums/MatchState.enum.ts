/**
 * Match State Enum
 *
 * Represents the current state of a football match (0-13)
 */

export enum MatchState {
  ABNORMAL = 0,           // Abnormal (suggest hiding)
  NOT_STARTED = 1,        // Not started
  FIRST_HALF = 2,         // First half
  HALF_TIME = 3,          // Half-time
  SECOND_HALF = 4,        // Second half
  OVERTIME = 5,           // Overtime
  OVERTIME_DEPRECATED = 6, // Overtime (deprecated)
  PENALTY_SHOOTOUT = 7,   // Penalty Shoot-out
  END = 8,                // End
  DELAY = 9,              // Delay
  INTERRUPT = 10,         // Interrupt
  CUT_IN_HALF = 11,       // Cut in half
  CANCEL = 12,            // Cancel
  TO_BE_DETERMINED = 13   // To be determined
}

/**
 * PR-12: LIVE match statuses - Single Source of Truth
 *
 * CRITICAL: HALF_TIME (3) is LIVE - players are on field, match is ongoing
 * Previous bug: isLiveMatchState() excluded HALF_TIME
 *
 * LIVE statuses: FIRST_HALF(2), HALF_TIME(3), SECOND_HALF(4), OVERTIME(5), PENALTY_SHOOTOUT(7)
 */
export const LIVE_STATUSES = [2, 3, 4, 5, 7] as const;

/**
 * SQL-compatible LIVE statuses string for queries
 * Usage: WHERE status_id IN (${LIVE_STATUSES_SQL})
 */
export const LIVE_STATUSES_SQL = '2, 3, 4, 5, 7';

/**
 * Check if match state is live
 *
 * PR-12 BUGFIX: HALF_TIME (3) is LIVE
 * - Players are still on field
 * - Match is ongoing (not finished)
 * - Jobs should process HALF_TIME matches
 */
export function isLiveMatchState(state: MatchState): boolean {
  return state === MatchState.FIRST_HALF ||
         state === MatchState.HALF_TIME ||        // PR-12: BUGFIX - Added HALF_TIME
         state === MatchState.SECOND_HALF ||
         state === MatchState.OVERTIME ||
         state === MatchState.PENALTY_SHOOTOUT;
}

/**
 * Check if match is finished
 * CRITICAL: Status 8 (END) might be a "false end" in cup matches
 * Cup matches can transition: 4 -> 8 -> 5 (Overtime) -> 8 -> 7 (Penalty) -> 8 (Final)
 * Use isDefinitelyFinished() for final confirmation
 */
export function isFinishedMatchState(state: MatchState): boolean {
  return state === MatchState.END || 
         state === MatchState.CANCEL;
}

/**
 * Check if match is definitely finished (no possibility of resurrection)
 * Status 8 might be followed by Overtime (5) or Penalty (7) in cup matches
 * Only CANCEL and END after sufficient time are definitely finished
 */
export function isDefinitelyFinished(state: MatchState, lastStatus8Time?: number): boolean {
  if (state === MatchState.CANCEL) {
    return true; // Cancelled matches are definitely finished
  }
  
  if (state === MatchState.END) {
    // If status 8 has been stable for 15+ minutes, consider it final
    if (lastStatus8Time) {
      const minutesSinceStatus8 = (Date.now() - lastStatus8Time) / (1000 * 60);
      return minutesSinceStatus8 >= 15; // 15 minutes threshold
    }
    // If no timestamp provided, assume it might be a false end
    return false;
  }
  
  return false;
}

/**
 * Check if match can transition from END to LIVE (resurrection)
 * Cup matches: Status 8 (End of Reg) -> 5 (Overtime) or 7 (Penalty)
 */
export function canResurrectFromEnd(currentState: MatchState): boolean {
  // If currently END, it might transition to OVERTIME or PENALTY_SHOOTOUT
  return currentState === MatchState.END;
}

