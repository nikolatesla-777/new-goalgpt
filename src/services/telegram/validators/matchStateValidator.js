"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMatchStateForPublish = validateMatchStateForPublish;
exports.getMatchStateName = getMatchStateName;
var MatchState_enum_1 = require("../../../types/thesports/enums/MatchState.enum");
var logger_1 = require("../../../utils/logger");
/**
 * PHASE-2A: Validate match state before publishing
 *
 * @param statusId - TheSports match status_id
 * @param matchId - Match identifier (for logging)
 * @returns Validation result
 */
function validateMatchStateForPublish(statusId, matchId) {
    var logContext = { match_id: matchId, status_id: statusId };
    // RULE 1: Match must be NOT_STARTED
    if (statusId === MatchState_enum_1.MatchState.NOT_STARTED) {
        logger_1.logger.info('[MatchValidator] ✅ Match is NOT_STARTED (valid for publish)', logContext);
        return { valid: true };
    }
    // RULE 2: Reject LIVE matches
    if ((0, MatchState_enum_1.isLiveMatchState)(statusId)) {
        var stateNames = {
            2: 'FIRST_HALF',
            3: 'HALF_TIME',
            4: 'SECOND_HALF',
            5: 'OVERTIME',
            7: 'PENALTY_SHOOTOUT',
        };
        var stateName = stateNames[statusId] || 'LIVE';
        logger_1.logger.warn('[MatchValidator] ❌ Match is LIVE - cannot publish', __assign(__assign({}, logContext), { state_name: stateName }));
        return {
            valid: false,
            error: "Match is already ".concat(stateName, ". Cannot publish predictions for live matches."),
            errorCode: 'MATCH_LIVE',
            currentState: statusId,
        };
    }
    // RULE 3: Reject FINISHED matches
    if ((0, MatchState_enum_1.isFinishedMatchState)(statusId)) {
        var stateNames = {
            8: 'FINISHED',
            12: 'CANCELLED',
        };
        var stateName = stateNames[statusId] || 'FINISHED';
        logger_1.logger.warn('[MatchValidator] ❌ Match is FINISHED - cannot publish', __assign(__assign({}, logContext), { state_name: stateName }));
        return {
            valid: false,
            error: "Match is ".concat(stateName, ". Cannot publish predictions for finished matches."),
            errorCode: 'MATCH_FINISHED',
            currentState: statusId,
        };
    }
    // RULE 4: Reject DELAYED, INTERRUPTED, POSTPONED, etc.
    var invalidStates = {
        0: 'ABNORMAL',
        9: 'DELAYED',
        10: 'INTERRUPTED',
        11: 'CUT_IN_HALF',
        13: 'TO_BE_DETERMINED',
    };
    if (invalidStates[statusId]) {
        var stateName = invalidStates[statusId];
        logger_1.logger.warn('[MatchValidator] ❌ Match is in invalid state - cannot publish', __assign(__assign({}, logContext), { state_name: stateName }));
        return {
            valid: false,
            error: "Match is ".concat(stateName, ". Cannot publish predictions for matches in this state."),
            errorCode: 'MATCH_INVALID_STATE',
            currentState: statusId,
        };
    }
    // Unknown state - reject to be safe
    logger_1.logger.error('[MatchValidator] ❌ Unknown match state - rejecting publish', logContext);
    return {
        valid: false,
        error: "Unknown match state (status_id: ".concat(statusId, "). Cannot publish."),
        errorCode: 'MATCH_UNKNOWN_STATE',
        currentState: statusId,
    };
}
/**
 * PHASE-2A: Get human-readable match state name
 */
function getMatchStateName(statusId) {
    var stateNames = {
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
    return stateNames[statusId] || "UNKNOWN(".concat(statusId, ")");
}
