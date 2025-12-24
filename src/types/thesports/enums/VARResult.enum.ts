/**
 * VAR Result Enum
 * 
 * Represents the result of VAR (Video Assistant Referee) review
 */

export enum VARResult {
  UNKNOWN = 0,                    // Unknown
  GOAL_CONFIRMED = 1,             // Goal confirmed
  GOAL_CANCELLED = 2,             // Goal cancelled
  PENALTY_CONFIRMED = 3,          // Penalty confirmed
  PENALTY_CANCELLED = 4,          // Penalty cancelled
  RED_CARD_CONFIRMED = 5,         // Red card confirmed
  RED_CARD_CANCELLED = 6,         // Red card cancelled
  CARD_UPGRADE_CONFIRMED = 7,     // Card upgrade confirmed
  CARD_UPGRADE_CANCELLED = 8,     // Card upgrade cancelled
  ORIGINAL_DECISION = 9,          // Original decision
  ORIGINAL_DECISION_CHANGED = 10  // Original decision changed
}

