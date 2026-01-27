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
function getPreferredFootName(foot, lang) {
    var _a;
    var _b;
    if (lang === void 0) { lang = 'en'; }
    var names = (_a = {},
        _a[PreferredFoot.UNKNOWN] = { en: 'Unknown', tr: 'Bilinmiyor' },
        _a[PreferredFoot.LEFT] = { en: 'Left', tr: 'Sol' },
        _a[PreferredFoot.RIGHT] = { en: 'Right', tr: 'Sağ' },
        _a[PreferredFoot.BOTH] = { en: 'Both', tr: 'Her İkisi' },
        _a);
    return ((_b = names[foot]) === null || _b === void 0 ? void 0 : _b[lang]) || 'Unknown';
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
