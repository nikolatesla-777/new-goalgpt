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
function getPositionName(position, lang = 'en') {
    const names = {
        [PlayerPosition.FORWARD]: { en: 'Forward', tr: 'Forvet' },
        [PlayerPosition.MIDFIELDER]: { en: 'Midfielder', tr: 'Orta Saha' },
        [PlayerPosition.DEFENDER]: { en: 'Defender', tr: 'Defans' },
        [PlayerPosition.GOALKEEPER]: { en: 'Goalkeeper', tr: 'Kaleci' }
    };
    return names[position]?.[lang] || position;
}
/**
 * Get position short name
 */
function getPositionShortName(position, lang = 'en') {
    const names = {
        [PlayerPosition.FORWARD]: { en: 'FW', tr: 'FRV' },
        [PlayerPosition.MIDFIELDER]: { en: 'MF', tr: 'OS' },
        [PlayerPosition.DEFENDER]: { en: 'DF', tr: 'DEF' },
        [PlayerPosition.GOALKEEPER]: { en: 'GK', tr: 'KLC' }
    };
    return names[position]?.[lang] || position;
}
/**
 * Get position color for UI
 */
function getPositionColor(position) {
    const colors = {
        [PlayerPosition.FORWARD]: '#e74c3c', // Red
        [PlayerPosition.MIDFIELDER]: '#3498db', // Blue
        [PlayerPosition.DEFENDER]: '#2ecc71', // Green
        [PlayerPosition.GOALKEEPER]: '#f39c12' // Orange
    };
    return colors[position] || '#95a5a6';
}
