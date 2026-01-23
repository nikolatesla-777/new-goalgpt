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
function getCoachTypeName(type, lang = 'en') {
    const names = {
        [CoachType.HEAD_COACH]: { en: 'Head Coach', tr: 'Teknik Direktör' },
        [CoachType.INTERIM]: { en: 'Interim Head Coach', tr: 'Geçici Teknik Direktör' }
    };
    return names[type]?.[lang] || 'Unknown';
}
