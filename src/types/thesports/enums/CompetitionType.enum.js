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
function getCompetitionTypeName(type, lang) {
    var _a;
    var _b;
    if (lang === void 0) { lang = 'en'; }
    var names = (_a = {},
        _a[CompetitionType.UNKNOWN] = { en: 'Unknown', tr: 'Bilinmiyor' },
        _a[CompetitionType.LEAGUE] = { en: 'League', tr: 'Lig' },
        _a[CompetitionType.CUP] = { en: 'Cup', tr: 'Kupa' },
        _a[CompetitionType.FRIENDLY] = { en: 'Friendly', tr: 'Hazırlık Maçı' },
        _a);
    return ((_b = names[type]) === null || _b === void 0 ? void 0 : _b[lang]) || 'Unknown';
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
