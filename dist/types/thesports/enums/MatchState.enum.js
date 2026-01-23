"use strict";
/**
 * Match State Enum
 *
 * Represents the current state of a football match (0-13)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchState = void 0;
exports.isLiveMatchState = isLiveMatchState;
exports.isFinishedMatchState = isFinishedMatchState;
exports.isDefinitelyFinished = isDefinitelyFinished;
exports.canResurrectFromEnd = canResurrectFromEnd;
var MatchState;
(function (MatchState) {
    MatchState[MatchState["ABNORMAL"] = 0] = "ABNORMAL";
    MatchState[MatchState["NOT_STARTED"] = 1] = "NOT_STARTED";
    MatchState[MatchState["FIRST_HALF"] = 2] = "FIRST_HALF";
    MatchState[MatchState["HALF_TIME"] = 3] = "HALF_TIME";
    MatchState[MatchState["SECOND_HALF"] = 4] = "SECOND_HALF";
    MatchState[MatchState["OVERTIME"] = 5] = "OVERTIME";
    MatchState[MatchState["OVERTIME_DEPRECATED"] = 6] = "OVERTIME_DEPRECATED";
    MatchState[MatchState["PENALTY_SHOOTOUT"] = 7] = "PENALTY_SHOOTOUT";
    MatchState[MatchState["END"] = 8] = "END";
    MatchState[MatchState["DELAY"] = 9] = "DELAY";
    MatchState[MatchState["INTERRUPT"] = 10] = "INTERRUPT";
    MatchState[MatchState["CUT_IN_HALF"] = 11] = "CUT_IN_HALF";
    MatchState[MatchState["CANCEL"] = 12] = "CANCEL";
    MatchState[MatchState["TO_BE_DETERMINED"] = 13] = "TO_BE_DETERMINED"; // To be determined
})(MatchState || (exports.MatchState = MatchState = {}));
/**
 * Check if match state is live
 */
function isLiveMatchState(state) {
    return state === MatchState.FIRST_HALF ||
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
function isFinishedMatchState(state) {
    return state === MatchState.END ||
        state === MatchState.CANCEL;
}
/**
 * Check if match is definitely finished (no possibility of resurrection)
 * Status 8 might be followed by Overtime (5) or Penalty (7) in cup matches
 * Only CANCEL and END after sufficient time are definitely finished
 */
function isDefinitelyFinished(state, lastStatus8Time) {
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
function canResurrectFromEnd(currentState) {
    // If currently END, it might transition to OVERTIME or PENALTY_SHOOTOUT
    return currentState === MatchState.END;
}
