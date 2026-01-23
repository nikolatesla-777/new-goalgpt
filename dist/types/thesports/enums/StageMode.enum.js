"use strict";
/**
 * Stage Mode Enum
 *
 * Represents the match mode for a competition stage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StageMode = void 0;
exports.getStageModeName = getStageModeName;
exports.isPointsBased = isPointsBased;
exports.isKnockout = isKnockout;
var StageMode;
(function (StageMode) {
    StageMode[StageMode["POINTS"] = 1] = "POINTS";
    StageMode[StageMode["ELIMINATION"] = 2] = "ELIMINATION"; // Elimination (Eleme sistemi - kupa formatı)
})(StageMode || (exports.StageMode = StageMode = {}));
/**
 * Get stage mode display name
 */
function getStageModeName(mode, lang = 'en') {
    const names = {
        [StageMode.POINTS]: { en: 'Points', tr: 'Puan Sistemi' },
        [StageMode.ELIMINATION]: { en: 'Elimination', tr: 'Eleme Sistemi' }
    };
    return names[mode]?.[lang] || 'Unknown';
}
/**
 * Check if stage uses points system
 */
function isPointsBased(mode) {
    return mode === StageMode.POINTS;
}
/**
 * Check if stage is knockout/elimination
 */
function isKnockout(mode) {
    return mode === StageMode.ELIMINATION;
}
