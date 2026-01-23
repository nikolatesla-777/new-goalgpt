"use strict";
/**
 * Injury Type Enum
 *
 * Represents player injury/availability status (0-3)
 * Used in lineup.injury[].type field
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InjuryType = void 0;
exports.getInjuryTypeName = getInjuryTypeName;
exports.getInjuryTypeColor = getInjuryTypeColor;
exports.getInjuryTypeIcon = getInjuryTypeIcon;
exports.isUnavailable = isUnavailable;
exports.isUncertain = isUncertain;
var InjuryType;
(function (InjuryType) {
    InjuryType[InjuryType["UNKNOWN"] = 0] = "UNKNOWN";
    InjuryType[InjuryType["INJURED"] = 1] = "INJURED";
    InjuryType[InjuryType["SUSPENDED"] = 2] = "SUSPENDED";
    InjuryType[InjuryType["QUESTIONABLE"] = 3] = "QUESTIONABLE"; // Belirsiz
})(InjuryType || (exports.InjuryType = InjuryType = {}));
/**
 * Get injury type display name
 */
function getInjuryTypeName(type, lang = 'en') {
    const names = {
        [InjuryType.UNKNOWN]: { en: 'Unknown', tr: 'Bilinmiyor' },
        [InjuryType.INJURED]: { en: 'Injured', tr: 'Sakatlık' },
        [InjuryType.SUSPENDED]: { en: 'Suspended', tr: 'Cezalı' },
        [InjuryType.QUESTIONABLE]: { en: 'Questionable', tr: 'Belirsiz' }
    };
    return names[type]?.[lang] || 'Unknown';
}
/**
 * Get injury type color for UI
 */
function getInjuryTypeColor(type) {
    const colors = {
        [InjuryType.UNKNOWN]: '#9CA3AF', // Gray
        [InjuryType.INJURED]: '#EF4444', // Red
        [InjuryType.SUSPENDED]: '#F59E0B', // Orange/Yellow
        [InjuryType.QUESTIONABLE]: '#3B82F6' // Blue
    };
    return colors[type] || '#9CA3AF';
}
/**
 * Get injury type icon/emoji for UI
 */
function getInjuryTypeIcon(type) {
    const icons = {
        [InjuryType.UNKNOWN]: '❓',
        [InjuryType.INJURED]: '🏥',
        [InjuryType.SUSPENDED]: '🟨',
        [InjuryType.QUESTIONABLE]: '⚠️'
    };
    return icons[type] || '❓';
}
/**
 * Check if player is definitely unavailable
 */
function isUnavailable(type) {
    return type === InjuryType.INJURED || type === InjuryType.SUSPENDED;
}
/**
 * Check if player availability is uncertain
 */
function isUncertain(type) {
    return type === InjuryType.QUESTIONABLE || type === InjuryType.UNKNOWN;
}
