"use strict";
/**
 * Player Detailed Position Enum
 *
 * Represents detailed player positions on the field
 * Used in player.positions array: [[main_position], [secondary_positions]]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerDetailedPosition = void 0;
exports.getDetailedPositionName = getDetailedPositionName;
exports.getGeneralPosition = getGeneralPosition;
exports.isAttackingPosition = isAttackingPosition;
var PlayerDetailedPosition;
(function (PlayerDetailedPosition) {
    // Forwards
    PlayerDetailedPosition["LW"] = "LW";
    PlayerDetailedPosition["RW"] = "RW";
    PlayerDetailedPosition["ST"] = "ST";
    // Midfielders
    PlayerDetailedPosition["AM"] = "AM";
    PlayerDetailedPosition["ML"] = "ML";
    PlayerDetailedPosition["MC"] = "MC";
    PlayerDetailedPosition["MR"] = "MR";
    PlayerDetailedPosition["DM"] = "DM";
    // Defenders
    PlayerDetailedPosition["DL"] = "DL";
    PlayerDetailedPosition["DC"] = "DC";
    PlayerDetailedPosition["DR"] = "DR";
    // Goalkeeper
    PlayerDetailedPosition["GK"] = "GK"; // Goalkeeper (Kaleci)
})(PlayerDetailedPosition || (exports.PlayerDetailedPosition = PlayerDetailedPosition = {}));
/**
 * Get detailed position display name
 */
function getDetailedPositionName(position, lang) {
    var _a;
    var _b;
    if (lang === void 0) { lang = 'en'; }
    var names = (_a = {},
        _a[PlayerDetailedPosition.LW] = { en: 'Left Forward', tr: 'Sol Kanat' },
        _a[PlayerDetailedPosition.RW] = { en: 'Right Forward', tr: 'Sağ Kanat' },
        _a[PlayerDetailedPosition.ST] = { en: 'Striker', tr: 'Forvet' },
        _a[PlayerDetailedPosition.AM] = { en: 'Attacking Midfielder', tr: 'Ofansif Orta Saha' },
        _a[PlayerDetailedPosition.ML] = { en: 'Left Midfielder', tr: 'Sol Orta Saha' },
        _a[PlayerDetailedPosition.MC] = { en: 'Center Midfielder', tr: 'Merkez Orta Saha' },
        _a[PlayerDetailedPosition.MR] = { en: 'Right Midfielder', tr: 'Sağ Orta Saha' },
        _a[PlayerDetailedPosition.DM] = { en: 'Defensive Midfielder', tr: 'Defansif Orta Saha' },
        _a[PlayerDetailedPosition.DL] = { en: 'Left Back', tr: 'Sol Bek' },
        _a[PlayerDetailedPosition.DC] = { en: 'Center Back', tr: 'Stoper' },
        _a[PlayerDetailedPosition.DR] = { en: 'Right Back', tr: 'Sağ Bek' },
        _a[PlayerDetailedPosition.GK] = { en: 'Goalkeeper', tr: 'Kaleci' },
        _a);
    return ((_b = names[position]) === null || _b === void 0 ? void 0 : _b[lang]) || position;
}
/**
 * Get general position from detailed position
 */
function getGeneralPosition(position) {
    switch (position) {
        case PlayerDetailedPosition.LW:
        case PlayerDetailedPosition.RW:
        case PlayerDetailedPosition.ST:
            return 'F'; // Forward
        case PlayerDetailedPosition.AM:
        case PlayerDetailedPosition.ML:
        case PlayerDetailedPosition.MC:
        case PlayerDetailedPosition.MR:
        case PlayerDetailedPosition.DM:
            return 'M'; // Midfielder
        case PlayerDetailedPosition.DL:
        case PlayerDetailedPosition.DC:
        case PlayerDetailedPosition.DR:
            return 'D'; // Defender
        case PlayerDetailedPosition.GK:
            return 'G'; // Goalkeeper
        default:
            return 'M'; // Default to midfielder
    }
}
/**
 * Check if position is attacking
 */
function isAttackingPosition(position) {
    return [
        PlayerDetailedPosition.LW,
        PlayerDetailedPosition.RW,
        PlayerDetailedPosition.ST,
        PlayerDetailedPosition.AM
    ].includes(position);
}
