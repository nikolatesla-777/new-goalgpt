"use strict";
/**
 * Competition Type Enum
 *
 * Represents the type of competition
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompetitionType = void 0;
exports.getCompetitionTypeName = getCompetitionTypeName;
exports.isLeague = isLeague;
exports.isCup = isCup;
var CompetitionType;
(function (CompetitionType) {
    CompetitionType[CompetitionType["UNKNOWN"] = 0] = "UNKNOWN";
    CompetitionType[CompetitionType["LEAGUE"] = 1] = "LEAGUE";
    CompetitionType[CompetitionType["CUP"] = 2] = "CUP";
    CompetitionType[CompetitionType["FRIENDLY"] = 3] = "FRIENDLY"; // Friendly (Hazırlık maçı)
})(CompetitionType || (exports.CompetitionType = CompetitionType = {}));
/**
 * Get competition type display name
 */
function getCompetitionTypeName(type, lang = 'en') {
    const names = {
        [CompetitionType.UNKNOWN]: { en: 'Unknown', tr: 'Bilinmiyor' },
        [CompetitionType.LEAGUE]: { en: 'League', tr: 'Lig' },
        [CompetitionType.CUP]: { en: 'Cup', tr: 'Kupa' },
        [CompetitionType.FRIENDLY]: { en: 'Friendly', tr: 'Hazırlık Maçı' }
    };
    return names[type]?.[lang] || 'Unknown';
}
/**
 * Check if competition type is league
 */
function isLeague(type) {
    return type === CompetitionType.LEAGUE;
}
/**
 * Check if competition type is cup
 */
function isCup(type) {
    return type === CompetitionType.CUP;
}
