"use strict";
/**
 * Preferred Foot Enum
 *
 * Represents player's preferred foot
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferredFoot = void 0;
exports.getPreferredFootName = getPreferredFootName;
exports.getFootEmoji = getFootEmoji;
var PreferredFoot;
(function (PreferredFoot) {
    PreferredFoot[PreferredFoot["UNKNOWN"] = 0] = "UNKNOWN";
    PreferredFoot[PreferredFoot["LEFT"] = 1] = "LEFT";
    PreferredFoot[PreferredFoot["RIGHT"] = 2] = "RIGHT";
    PreferredFoot[PreferredFoot["BOTH"] = 3] = "BOTH"; // Both feet (Her iki ayak)
})(PreferredFoot || (exports.PreferredFoot = PreferredFoot = {}));
/**
 * Get preferred foot display name
 */
function getPreferredFootName(foot, lang = 'en') {
    const names = {
        [PreferredFoot.UNKNOWN]: { en: 'Unknown', tr: 'Bilinmiyor' },
        [PreferredFoot.LEFT]: { en: 'Left', tr: 'Sol' },
        [PreferredFoot.RIGHT]: { en: 'Right', tr: 'Sağ' },
        [PreferredFoot.BOTH]: { en: 'Both', tr: 'Her İkisi' }
    };
    return names[foot]?.[lang] || 'Unknown';
}
/**
 * Get foot emoji for UI
 */
function getFootEmoji(foot) {
    switch (foot) {
        case PreferredFoot.LEFT:
            return '🦶⬅️';
        case PreferredFoot.RIGHT:
            return '🦶➡️';
        case PreferredFoot.BOTH:
            return '🦶🦶';
        default:
            return '❓';
    }
}
