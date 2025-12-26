/**
 * Technical Statistics Enum
 * 
 * Represents technical statistics types in match data (1-37)
 */

export enum TechnicalStatistics {
  GOAL = 1,                    // Goal
  CORNER = 2,                  // Corner
  YELLOW_CARD = 3,             // Yellow card
  RED_CARD = 4,                // Red card
  OFFSIDE = 5,                 // Offside
  FREE_KICK = 6,               // Free kick
  GOAL_KICK = 7,               // Goal kick
  PENALTY = 8,                 // Penalty
  SUBSTITUTION = 9,            // Substitution
  START = 10,                  // Start
  MIDFIELD = 11,               // Midfield
  END = 12,                    // End
  HALFTIME_SCORE = 13,         // Halftime score
  CARD_UPGRADE_CONFIRMED = 15, // Card upgrade confirmed
  PENALTY_MISSED = 16,         // Penalty missed
  OWN_GOAL = 17,               // Own goal
  INJURY_TIME = 19,            // Injury time
  SHOTS_ON_TARGET = 21,        // Shots on target
  SHOTS_OFF_TARGET = 22,       // Shots off target (actually 5 in some endpoints, but consistent with enum)
  ATTACKS = 23,                // Attacks
  DANGEROUS_ATTACK = 24,       // Dangerous Attack
  BALL_POSSESSION = 25,        // Ball possession
  OVERTIME_IS_OVER = 26,       // Overtime is over
  PENALTY_KICK_ENDED = 27,     // Penalty kick ended
  VAR = 28,                    // VAR (Video assistant referee)
  PENALTY_SHOOTOUT = 29,       // Penalty (Penalty Shoot-out)
  PENALTY_MISSED_SHOOTOUT = 30, // Penalty missed (Penalty Shoot-out)
  SHOT_ON_POST = 34,           // Shot on post
  BLOCKED_SHOTS = 37,          // Blocked shots
  FOULS = 42,                  // Fouls (Common in some endpoints)
  SAVES = 43                   // Saves (Common in some endpoints)
}

/**
 * Check if statistic is a goal event
 */
export function isGoalStatistic(stat: TechnicalStatistics): boolean {
  return stat === TechnicalStatistics.GOAL ||
    stat === TechnicalStatistics.OWN_GOAL;
}

/**
 * Check if statistic is a card event
 */
export function isCardStatistic(stat: TechnicalStatistics): boolean {
  return stat === TechnicalStatistics.YELLOW_CARD ||
    stat === TechnicalStatistics.RED_CARD ||
    stat === TechnicalStatistics.CARD_UPGRADE_CONFIRMED;
}

