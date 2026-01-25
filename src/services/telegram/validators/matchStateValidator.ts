/**
 * PHASE-2A: Match State Validator
 *
 * Purpose: Prevent publishing matches that are already started, finished, or invalid
 *
 * Rules:
 * 1. Match must be NOT_STARTED (status_id = 1)
 * 2. Reject LIVE matches (status_id = 2,3,4,5,7)
 * 3. Reject FINISHED matches (status_id = 8)
 * 4. Reject CANCELLED/POSTPONED matches (status_id = 9,10,12,13)
 */

import { MatchState, isLiveMatchState, isFinishedMatchState } from '../../../types/thesports/enums/MatchState.enum';
import { logger } from '../../../utils/logger';

export interface MatchStateValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  currentState?: MatchState;
}

/**
 * PHASE-2A: Validate match state before publishing
 *
 * @param statusId - TheSports match status_id
 * @param matchId - Match identifier (for logging)
 * @returns Validation result
 */
export function validateMatchStateForPublish(
  statusId: number,
  matchId: string
): MatchStateValidationResult {
  const logContext = { match_id: matchId, status_id: statusId };

  // RULE 1: Match must be NOT_STARTED
  if (statusId === MatchState.NOT_STARTED) {
    logger.info('[MatchValidator] ✅ Match is NOT_STARTED (valid for publish)', logContext);
    return { valid: true };
  }

  // RULE 2: Reject LIVE matches
  if (isLiveMatchState(statusId as MatchState)) {
    const stateNames: Record<number, string> = {
      2: 'FIRST_HALF',
      3: 'HALF_TIME',
      4: 'SECOND_HALF',
      5: 'OVERTIME',
      7: 'PENALTY_SHOOTOUT',
    };

    const stateName = stateNames[statusId] || 'LIVE';
    logger.warn('[MatchValidator] ❌ Match is LIVE - cannot publish', {
      ...logContext,
      state_name: stateName,
    });

    return {
      valid: false,
      error: `Match is already ${stateName}. Cannot publish predictions for live matches.`,
      errorCode: 'MATCH_LIVE',
      currentState: statusId as MatchState,
    };
  }

  // RULE 3: Reject FINISHED matches
  if (isFinishedMatchState(statusId as MatchState)) {
    const stateNames: Record<number, string> = {
      8: 'FINISHED',
      12: 'CANCELLED',
    };

    const stateName = stateNames[statusId] || 'FINISHED';
    logger.warn('[MatchValidator] ❌ Match is FINISHED - cannot publish', {
      ...logContext,
      state_name: stateName,
    });

    return {
      valid: false,
      error: `Match is ${stateName}. Cannot publish predictions for finished matches.`,
      errorCode: 'MATCH_FINISHED',
      currentState: statusId as MatchState,
    };
  }

  // RULE 4: Reject DELAYED, INTERRUPTED, POSTPONED, etc.
  const invalidStates: Record<number, string> = {
    0: 'ABNORMAL',
    9: 'DELAYED',
    10: 'INTERRUPTED',
    11: 'CUT_IN_HALF',
    13: 'TO_BE_DETERMINED',
  };

  if (invalidStates[statusId]) {
    const stateName = invalidStates[statusId];
    logger.warn('[MatchValidator] ❌ Match is in invalid state - cannot publish', {
      ...logContext,
      state_name: stateName,
    });

    return {
      valid: false,
      error: `Match is ${stateName}. Cannot publish predictions for matches in this state.`,
      errorCode: 'MATCH_INVALID_STATE',
      currentState: statusId as MatchState,
    };
  }

  // Unknown state - reject to be safe
  logger.error('[MatchValidator] ❌ Unknown match state - rejecting publish', logContext);
  return {
    valid: false,
    error: `Unknown match state (status_id: ${statusId}). Cannot publish.`,
    errorCode: 'MATCH_UNKNOWN_STATE',
    currentState: statusId as MatchState,
  };
}

/**
 * PHASE-2A: Get human-readable match state name
 */
export function getMatchStateName(statusId: number): string {
  const stateNames: Record<number, string> = {
    0: 'ABNORMAL',
    1: 'NOT_STARTED',
    2: 'FIRST_HALF',
    3: 'HALF_TIME',
    4: 'SECOND_HALF',
    5: 'OVERTIME',
    7: 'PENALTY_SHOOTOUT',
    8: 'FINISHED',
    9: 'DELAYED',
    10: 'INTERRUPTED',
    11: 'CUT_IN_HALF',
    12: 'CANCELLED',
    13: 'TO_BE_DETERMINED',
  };

  return stateNames[statusId] || `UNKNOWN(${statusId})`;
}
