"use strict";
/**
 * Player Position Enum
 *
 * Represents general player positions (F, M, D, G)
 * Used in player.position field
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerPosition = void 0;
exports.getPositionName = getPositionName;
exports.getPositionShortName = getPositionShortName;
exports.getPositionColor = getPositionColor;
var PlayerPosition;
(function (PlayerPosition) {
    PlayerPosition["FORWARD"] = "F";
    PlayerPosition["MIDFIELDER"] = "M";
    PlayerPosition["DEFENDER"] = "D";
    PlayerPosition["GOALKEEPER"] = "G"; // Goalkeeper (Kaleci)
})(PlayerPosition || (exports.PlayerPosition = PlayerPosition = {}));
/**
 * Get position display name
 */
function getPositionName(position, lang) {
    var _a;
    var _b;
    if (lang === void 0) { lang = 'en'; }
    var names = (_a = {},
        _a[PlayerPosition.FORWARD] = { en: 'Forward', tr: 'Forvet' },
        _a[PlayerPosition.MIDFIELDER] = { en: 'Midfielder', tr: 'Orta Saha' },
        _a[PlayerPosition.DEFENDER] = { en: 'Defender', tr: 'Defans' },
        _a[PlayerPosition.GOALKEEPER] = { en: 'Goalkeeper', tr: 'Kaleci' },
        _a);
    return ((_b = names[position]) === null || _b === void 0 ? void 0 : _b[lang]) || position;
}
/**
 * Get position short name
 */
function getPositionShortName(position, lang) {
    var _a;
    var _b;
    if (lang === void 0) { lang = 'en'; }
    var names = (_a = {},
        _a[PlayerPosition.FORWARD] = { en: 'FW', tr: 'FRV' },
        _a[PlayerPosition.MIDFIELDER] = { en: 'MF', tr: 'OS' },
        _a[PlayerPosition.DEFENDER] = { en: 'DF', tr: 'DEF' },
        _a[PlayerPosition.GOALKEEPER] = { en: 'GK', tr: 'KLC' },
        _a);
    return ((_b = names[position]) === null || _b === void 0 ? void 0 : _b[lang]) || position;
}
/**
 * Get position color for UI
 */
function getPositionColor(position) {
    var _a;
    var colors = (_a = {},
        _a[PlayerPosition.FORWARD] = '#e74c3c',
        _a[PlayerPosition.MIDFIELDER] = '#3498db',
        _a[PlayerPosition.DEFENDER] = '#2ecc71',
        _a[PlayerPosition.GOALKEEPER] = '#f39c12' // Orange
    ,
        _a);
    return colors[position] || '#95a5a6';
}
