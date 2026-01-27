"use strict";
/**
 * Technical Statistics Enum
 *
 * Represents technical statistics types in match data (1-37)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TechnicalStatistics = void 0;
exports.isGoalStatistic = isGoalStatistic;
exports.isCardStatistic = isCardStatistic;
var TechnicalStatistics;
(function (TechnicalStatistics) {
    TechnicalStatistics[TechnicalStatistics["GOAL"] = 1] = "GOAL";
    TechnicalStatistics[TechnicalStatistics["CORNER"] = 2] = "CORNER";
    TechnicalStatistics[TechnicalStatistics["YELLOW_CARD"] = 3] = "YELLOW_CARD";
    TechnicalStatistics[TechnicalStatistics["RED_CARD"] = 4] = "RED_CARD";
    TechnicalStatistics[TechnicalStatistics["OFFSIDE"] = 5] = "OFFSIDE";
    TechnicalStatistics[TechnicalStatistics["FREE_KICK"] = 6] = "FREE_KICK";
    TechnicalStatistics[TechnicalStatistics["GOAL_KICK"] = 7] = "GOAL_KICK";
    TechnicalStatistics[TechnicalStatistics["PENALTY"] = 8] = "PENALTY";
    TechnicalStatistics[TechnicalStatistics["SUBSTITUTION"] = 9] = "SUBSTITUTION";
    TechnicalStatistics[TechnicalStatistics["START"] = 10] = "START";
    TechnicalStatistics[TechnicalStatistics["MIDFIELD"] = 11] = "MIDFIELD";
    TechnicalStatistics[TechnicalStatistics["END"] = 12] = "END";
    TechnicalStatistics[TechnicalStatistics["HALFTIME_SCORE"] = 13] = "HALFTIME_SCORE";
    TechnicalStatistics[TechnicalStatistics["CARD_UPGRADE_CONFIRMED"] = 15] = "CARD_UPGRADE_CONFIRMED";
    TechnicalStatistics[TechnicalStatistics["PENALTY_MISSED"] = 16] = "PENALTY_MISSED";
    TechnicalStatistics[TechnicalStatistics["OWN_GOAL"] = 17] = "OWN_GOAL";
    TechnicalStatistics[TechnicalStatistics["INJURY_TIME"] = 19] = "INJURY_TIME";
    TechnicalStatistics[TechnicalStatistics["SHOTS_ON_TARGET"] = 21] = "SHOTS_ON_TARGET";
    TechnicalStatistics[TechnicalStatistics["SHOTS_OFF_TARGET"] = 22] = "SHOTS_OFF_TARGET";
    TechnicalStatistics[TechnicalStatistics["ATTACKS"] = 23] = "ATTACKS";
    TechnicalStatistics[TechnicalStatistics["DANGEROUS_ATTACK"] = 24] = "DANGEROUS_ATTACK";
    TechnicalStatistics[TechnicalStatistics["BALL_POSSESSION"] = 25] = "BALL_POSSESSION";
    TechnicalStatistics[TechnicalStatistics["OVERTIME_IS_OVER"] = 26] = "OVERTIME_IS_OVER";
    TechnicalStatistics[TechnicalStatistics["PENALTY_KICK_ENDED"] = 27] = "PENALTY_KICK_ENDED";
    TechnicalStatistics[TechnicalStatistics["VAR"] = 28] = "VAR";
    TechnicalStatistics[TechnicalStatistics["PENALTY_SHOOTOUT"] = 29] = "PENALTY_SHOOTOUT";
    TechnicalStatistics[TechnicalStatistics["PENALTY_MISSED_SHOOTOUT"] = 30] = "PENALTY_MISSED_SHOOTOUT";
    TechnicalStatistics[TechnicalStatistics["SHOT_ON_POST"] = 34] = "SHOT_ON_POST";
    TechnicalStatistics[TechnicalStatistics["BLOCKED_SHOTS"] = 37] = "BLOCKED_SHOTS";
    TechnicalStatistics[TechnicalStatistics["SAVES"] = 43] = "SAVES";
    // Detailed Stats (Mapped from team_stats/list named fields)
    TechnicalStatistics[TechnicalStatistics["TOTAL_PASSES"] = 101] = "TOTAL_PASSES";
    TechnicalStatistics[TechnicalStatistics["ACCURATE_PASSES"] = 102] = "ACCURATE_PASSES";
    TechnicalStatistics[TechnicalStatistics["KEY_PASSES"] = 103] = "KEY_PASSES";
    TechnicalStatistics[TechnicalStatistics["ACCURATE_CROSSES"] = 104] = "ACCURATE_CROSSES";
    TechnicalStatistics[TechnicalStatistics["ACCURATE_LONG_BALLS"] = 105] = "ACCURATE_LONG_BALLS";
    TechnicalStatistics[TechnicalStatistics["INTERCEPTIONS"] = 106] = "INTERCEPTIONS";
    TechnicalStatistics[TechnicalStatistics["FOULS"] = 107] = "FOULS";
    TechnicalStatistics[TechnicalStatistics["OFFSIDES"] = 108] = "OFFSIDES";
    TechnicalStatistics[TechnicalStatistics["FASTBREAK_SHOTS"] = 109] = "FASTBREAK_SHOTS";
    TechnicalStatistics[TechnicalStatistics["DUELS_TACKLES"] = 110] = "DUELS_TACKLES";
    TechnicalStatistics[TechnicalStatistics["CLEARANCES"] = 111] = "CLEARANCES";
    TechnicalStatistics[TechnicalStatistics["SUCCESSFUL_DRIBBLES"] = 112] = "SUCCESSFUL_DRIBBLES";
    TechnicalStatistics[TechnicalStatistics["DUELS_WON"] = 113] = "DUELS_WON";
    TechnicalStatistics[TechnicalStatistics["HIT_WOODWORK"] = 115] = "HIT_WOODWORK";
})(TechnicalStatistics || (exports.TechnicalStatistics = TechnicalStatistics = {}));
/**
 * Check if statistic is a goal event
 */
function isGoalStatistic(stat) {
    return stat === TechnicalStatistics.GOAL ||
        stat === TechnicalStatistics.OWN_GOAL;
}
/**
 * Check if statistic is a card event
 */
function isCardStatistic(stat) {
    return stat === TechnicalStatistics.YELLOW_CARD ||
        stat === TechnicalStatistics.RED_CARD ||
        stat === TechnicalStatistics.CARD_UPGRADE_CONFIRMED;
}
