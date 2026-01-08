/**
 * Half-time Statistics Enum
 * 
 * Represents statistics for half-time data (1-83)
 */

export enum HalfTimeStatistics {
  GOAL = 1,                       // Goal
  CORNER = 2,                     // Corner
  YELLOW_CARD = 3,                // Yellow card
  RED_CARD = 4,                   // Red card
  OFFSIDE = 5,                    // Offside
  FREE_KICK = 6,                  // Free kick
  GOAL_KICK = 7,                  // Goal kick
  PENALTY = 8,                    // Penalty
  SUBSTITUTION = 9,               // Substitution
  CARD_UPGRADE_CONFIRMED = 15,    // Card upgrade confirmed
  PENALTY_MISSED = 16,            // Penalty missed
  OWN_GOAL = 17,                  // Own goal
  SHOTS_ON_TARGET = 21,           // Shots on target
  SHOTS_OFF_TARGET = 22,          // Shots off target
  ATTACKS = 23,                   // Attacks
  DANGEROUS_ATTACK = 24,          // Dangerous Attack
  BALL_POSSESSION = 25,           // Ball possession
  DRIBBLE = 33,                   // Dribble
  DRIBBLE_SUCCESS = 34,          // Dribble success
  CLEARANCES = 36,                // Clearances
  BLOCKED_SHOTS = 37,             // Blocked shots
  INTERCEPT = 38,                 // Intercept
  TACKLES = 39,                   // Tackles
  PASS = 40,                      // Pass
  PASS_SUCCESS = 41,             // Pass success
  KEY_PASSES = 42,                // key passes
  CROSS = 43,                     // Cross
  CROSS_SUCCESS = 44,             // Cross success
  LONG_PASS = 45,                 // Long pass
  LONG_PASS_SUCCESS = 46,         // Long pass success
  ONE_TO_ONE_FIGHT_SUCCESS = 48, // 1 to 1 fight success
  PASS_BROKEN = 49,               // The pass is broken
  FOULS = 51,                     // Fouls
  SAVE = 52,                      // Save
  PUNCHES = 53,                   // Punches
  GOALKEEPER_STRIKES = 54,        // Goalkeeper strikes
  GOALKEEPER_STRIKES_SUCCESS = 55, // Goalkeeper strikes success
  HIGH_ALTITUDE_ATTACK = 56,      // High altitude attack
  ONE_ON_ONE_FIGHT_FAILED = 61,   // 1 on 1 fight failed
  FREE_KICK_HALF = 63,            // Free kick
  FREE_KICK_GOAL = 65,            // Free kick goal
  HIT_WOODWORK = 69,              // Hit woodwork
  FAST_BREAK = 70,                // Fast break
  FAST_BREAK_SHOT = 71,           // Fast break shot
  FAST_BREAK_GOAL = 72,           // Fast break goal
  LOST_THE_BALL = 78,             // Lost the ball
  WIN_AERIAL_DUEL = 79,           // Win the aerial duel
  LOSE_AERIAL_DUEL = 80,          // Lose the aerial duel
  WIN_GROUND_DUEL = 81,           // Win the ground duel
  LOSE_GROUND_DUEL = 82,          // Lose the ground duel
  SHOTS = 83                      // Shots
}

