"use strict";
/**
 * Coach Type Enum
 *
 * Represents the type of coach position
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoachType = void 0;
exports.getCoachTypeName = getCoachTypeName;
var CoachType;
(function (CoachType) {
    CoachType[CoachType["HEAD_COACH"] = 1] = "HEAD_COACH";
    CoachType[CoachType["INTERIM"] = 2] = "INTERIM"; // Interim head coach (Geçici teknik direktör)
})(CoachType || (exports.CoachType = CoachType = {}));
/**
 * Get coach type display name
 */
function getCoachTypeName(type, lang) {
    var _a;
    var _b;
    if (lang === void 0) { lang = 'en'; }
    var names = (_a = {},
        _a[CoachType.HEAD_COACH] = { en: 'Head Coach', tr: 'Teknik Direktör' },
        _a[CoachType.INTERIM] = { en: 'Interim Head Coach', tr: 'Geçici Teknik Direktör' },
        _a);
    return ((_b = names[type]) === null || _b === void 0 ? void 0 : _b[lang]) || 'Unknown';
}
