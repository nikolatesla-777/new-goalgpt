"use strict";
/**
 * VAR Reason Enum
 *
 * Represents reasons for VAR (Video Assistant Referee) review
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VARReason = void 0;
var VARReason;
(function (VARReason) {
    VARReason[VARReason["OTHER"] = 0] = "OTHER";
    VARReason[VARReason["GOAL_AWARDED"] = 1] = "GOAL_AWARDED";
    VARReason[VARReason["GOAL_NOT_AWARDED"] = 2] = "GOAL_NOT_AWARDED";
    VARReason[VARReason["PENALTY_AWARDED"] = 3] = "PENALTY_AWARDED";
    VARReason[VARReason["PENALTY_NOT_AWARDED"] = 4] = "PENALTY_NOT_AWARDED";
    VARReason[VARReason["RED_CARD_GIVEN"] = 5] = "RED_CARD_GIVEN";
    VARReason[VARReason["CARD_UPGRADE"] = 6] = "CARD_UPGRADE";
    VARReason[VARReason["MISTAKEN_IDENTITY"] = 7] = "MISTAKEN_IDENTITY"; // Mistaken identity
})(VARReason || (exports.VARReason = VARReason = {}));
