"use strict";
/**
 * VAR Result Enum
 *
 * Represents the result of VAR (Video Assistant Referee) review
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VARResult = void 0;
var VARResult;
(function (VARResult) {
    VARResult[VARResult["UNKNOWN"] = 0] = "UNKNOWN";
    VARResult[VARResult["GOAL_CONFIRMED"] = 1] = "GOAL_CONFIRMED";
    VARResult[VARResult["GOAL_CANCELLED"] = 2] = "GOAL_CANCELLED";
    VARResult[VARResult["PENALTY_CONFIRMED"] = 3] = "PENALTY_CONFIRMED";
    VARResult[VARResult["PENALTY_CANCELLED"] = 4] = "PENALTY_CANCELLED";
    VARResult[VARResult["RED_CARD_CONFIRMED"] = 5] = "RED_CARD_CONFIRMED";
    VARResult[VARResult["RED_CARD_CANCELLED"] = 6] = "RED_CARD_CANCELLED";
    VARResult[VARResult["CARD_UPGRADE_CONFIRMED"] = 7] = "CARD_UPGRADE_CONFIRMED";
    VARResult[VARResult["CARD_UPGRADE_CANCELLED"] = 8] = "CARD_UPGRADE_CANCELLED";
    VARResult[VARResult["ORIGINAL_DECISION"] = 9] = "ORIGINAL_DECISION";
    VARResult[VARResult["ORIGINAL_DECISION_CHANGED"] = 10] = "ORIGINAL_DECISION_CHANGED"; // Original decision changed
})(VARResult || (exports.VARResult = VARResult = {}));
