/**
 * VAR Reason Enum
 * 
 * Represents reasons for VAR (Video Assistant Referee) review
 */

export enum VARReason {
  OTHER = 0,                      // Other
  GOAL_AWARDED = 1,               // Goal awarded
  GOAL_NOT_AWARDED = 2,           // Goal not awarded
  PENALTY_AWARDED = 3,            // Penalty awarded
  PENALTY_NOT_AWARDED = 4,        // Penalty not awarded
  RED_CARD_GIVEN = 5,             // Red card given
  CARD_UPGRADE = 6,               // Card upgrade
  MISTAKEN_IDENTITY = 7           // Mistaken identity
}

