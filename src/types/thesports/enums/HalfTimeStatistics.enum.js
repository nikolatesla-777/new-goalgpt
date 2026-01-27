"use strict";
/**
 * Half-time Statistics Enum
 *
 * Represents statistics for half-time data (1-83)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HalfTimeStatistics = void 0;
var HalfTimeStatistics;
(function (HalfTimeStatistics) {
    HalfTimeStatistics[HalfTimeStatistics["GOAL"] = 1] = "GOAL";
    HalfTimeStatistics[HalfTimeStatistics["CORNER"] = 2] = "CORNER";
    HalfTimeStatistics[HalfTimeStatistics["YELLOW_CARD"] = 3] = "YELLOW_CARD";
    HalfTimeStatistics[HalfTimeStatistics["RED_CARD"] = 4] = "RED_CARD";
    HalfTimeStatistics[HalfTimeStatistics["OFFSIDE"] = 5] = "OFFSIDE";
    HalfTimeStatistics[HalfTimeStatistics["FREE_KICK"] = 6] = "FREE_KICK";
    HalfTimeStatistics[HalfTimeStatistics["GOAL_KICK"] = 7] = "GOAL_KICK";
    HalfTimeStatistics[HalfTimeStatistics["PENALTY"] = 8] = "PENALTY";
    HalfTimeStatistics[HalfTimeStatistics["SUBSTITUTION"] = 9] = "SUBSTITUTION";
    HalfTimeStatistics[HalfTimeStatistics["CARD_UPGRADE_CONFIRMED"] = 15] = "CARD_UPGRADE_CONFIRMED";
    HalfTimeStatistics[HalfTimeStatistics["PENALTY_MISSED"] = 16] = "PENALTY_MISSED";
    HalfTimeStatistics[HalfTimeStatistics["OWN_GOAL"] = 17] = "OWN_GOAL";
    HalfTimeStatistics[HalfTimeStatistics["SHOTS_ON_TARGET"] = 21] = "SHOTS_ON_TARGET";
    HalfTimeStatistics[HalfTimeStatistics["SHOTS_OFF_TARGET"] = 22] = "SHOTS_OFF_TARGET";
    HalfTimeStatistics[HalfTimeStatistics["ATTACKS"] = 23] = "ATTACKS";
    HalfTimeStatistics[HalfTimeStatistics["DANGEROUS_ATTACK"] = 24] = "DANGEROUS_ATTACK";
    HalfTimeStatistics[HalfTimeStatistics["BALL_POSSESSION"] = 25] = "BALL_POSSESSION";
    HalfTimeStatistics[HalfTimeStatistics["DRIBBLE"] = 33] = "DRIBBLE";
    HalfTimeStatistics[HalfTimeStatistics["DRIBBLE_SUCCESS"] = 34] = "DRIBBLE_SUCCESS";
    HalfTimeStatistics[HalfTimeStatistics["CLEARANCES"] = 36] = "CLEARANCES";
    HalfTimeStatistics[HalfTimeStatistics["BLOCKED_SHOTS"] = 37] = "BLOCKED_SHOTS";
    HalfTimeStatistics[HalfTimeStatistics["INTERCEPT"] = 38] = "INTERCEPT";
    HalfTimeStatistics[HalfTimeStatistics["TACKLES"] = 39] = "TACKLES";
    HalfTimeStatistics[HalfTimeStatistics["PASS"] = 40] = "PASS";
    HalfTimeStatistics[HalfTimeStatistics["PASS_SUCCESS"] = 41] = "PASS_SUCCESS";
    HalfTimeStatistics[HalfTimeStatistics["KEY_PASSES"] = 42] = "KEY_PASSES";
    HalfTimeStatistics[HalfTimeStatistics["CROSS"] = 43] = "CROSS";
    HalfTimeStatistics[HalfTimeStatistics["CROSS_SUCCESS"] = 44] = "CROSS_SUCCESS";
    HalfTimeStatistics[HalfTimeStatistics["LONG_PASS"] = 45] = "LONG_PASS";
    HalfTimeStatistics[HalfTimeStatistics["LONG_PASS_SUCCESS"] = 46] = "LONG_PASS_SUCCESS";
    HalfTimeStatistics[HalfTimeStatistics["ONE_TO_ONE_FIGHT_SUCCESS"] = 48] = "ONE_TO_ONE_FIGHT_SUCCESS";
    HalfTimeStatistics[HalfTimeStatistics["PASS_BROKEN"] = 49] = "PASS_BROKEN";
    HalfTimeStatistics[HalfTimeStatistics["FOULS"] = 51] = "FOULS";
    HalfTimeStatistics[HalfTimeStatistics["SAVE"] = 52] = "SAVE";
    HalfTimeStatistics[HalfTimeStatistics["PUNCHES"] = 53] = "PUNCHES";
    HalfTimeStatistics[HalfTimeStatistics["GOALKEEPER_STRIKES"] = 54] = "GOALKEEPER_STRIKES";
    HalfTimeStatistics[HalfTimeStatistics["GOALKEEPER_STRIKES_SUCCESS"] = 55] = "GOALKEEPER_STRIKES_SUCCESS";
    HalfTimeStatistics[HalfTimeStatistics["HIGH_ALTITUDE_ATTACK"] = 56] = "HIGH_ALTITUDE_ATTACK";
    HalfTimeStatistics[HalfTimeStatistics["ONE_ON_ONE_FIGHT_FAILED"] = 61] = "ONE_ON_ONE_FIGHT_FAILED";
    HalfTimeStatistics[HalfTimeStatistics["FREE_KICK_HALF"] = 63] = "FREE_KICK_HALF";
    HalfTimeStatistics[HalfTimeStatistics["FREE_KICK_GOAL"] = 65] = "FREE_KICK_GOAL";
    HalfTimeStatistics[HalfTimeStatistics["HIT_WOODWORK"] = 69] = "HIT_WOODWORK";
    HalfTimeStatistics[HalfTimeStatistics["FAST_BREAK"] = 70] = "FAST_BREAK";
    HalfTimeStatistics[HalfTimeStatistics["FAST_BREAK_SHOT"] = 71] = "FAST_BREAK_SHOT";
    HalfTimeStatistics[HalfTimeStatistics["FAST_BREAK_GOAL"] = 72] = "FAST_BREAK_GOAL";
    HalfTimeStatistics[HalfTimeStatistics["LOST_THE_BALL"] = 78] = "LOST_THE_BALL";
    HalfTimeStatistics[HalfTimeStatistics["WIN_AERIAL_DUEL"] = 79] = "WIN_AERIAL_DUEL";
    HalfTimeStatistics[HalfTimeStatistics["LOSE_AERIAL_DUEL"] = 80] = "LOSE_AERIAL_DUEL";
    HalfTimeStatistics[HalfTimeStatistics["WIN_GROUND_DUEL"] = 81] = "WIN_GROUND_DUEL";
    HalfTimeStatistics[HalfTimeStatistics["LOSE_GROUND_DUEL"] = 82] = "LOSE_GROUND_DUEL";
    HalfTimeStatistics[HalfTimeStatistics["SHOTS"] = 83] = "SHOTS"; // Shots
})(HalfTimeStatistics || (exports.HalfTimeStatistics = HalfTimeStatistics = {}));
