"use strict";
/**
 * Player Ability Type Enum
 *
 * Represents player ability score types (1-9)
 * Used in player.ability array: [type_id, rating (0-100), average_score (0-100)]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerAbilityType = void 0;
exports.getAbilityTypeName = getAbilityTypeName;
exports.isGoalkeeperAbility = isGoalkeeperAbility;
var PlayerAbilityType;
(function (PlayerAbilityType) {
    PlayerAbilityType[PlayerAbilityType["SAVE"] = 1] = "SAVE";
    PlayerAbilityType[PlayerAbilityType["PRE_JUDGMENT"] = 2] = "PRE_JUDGMENT";
    PlayerAbilityType[PlayerAbilityType["HANDLING"] = 3] = "HANDLING";
    PlayerAbilityType[PlayerAbilityType["AIR"] = 4] = "AIR";
    PlayerAbilityType[PlayerAbilityType["TACTICS"] = 5] = "TACTICS";
    PlayerAbilityType[PlayerAbilityType["ATTACK"] = 6] = "ATTACK";
    PlayerAbilityType[PlayerAbilityType["DEFENSE"] = 7] = "DEFENSE";
    PlayerAbilityType[PlayerAbilityType["CREATIVITY"] = 8] = "CREATIVITY";
    PlayerAbilityType[PlayerAbilityType["TECHNOLOGY"] = 9] = "TECHNOLOGY"; // Technology (Teknik)
})(PlayerAbilityType || (exports.PlayerAbilityType = PlayerAbilityType = {}));
/**
 * Get ability type display name
 */
function getAbilityTypeName(type, lang = 'en') {
    const names = {
        [PlayerAbilityType.SAVE]: { en: 'Save', tr: 'Kurtarış' },
        [PlayerAbilityType.PRE_JUDGMENT]: { en: 'Pre-judgment', tr: 'Öngörü' },
        [PlayerAbilityType.HANDLING]: { en: 'Handling', tr: 'Top Kontrolü' },
        [PlayerAbilityType.AIR]: { en: 'Air', tr: 'Hava Topu' },
        [PlayerAbilityType.TACTICS]: { en: 'Tactics', tr: 'Taktik' },
        [PlayerAbilityType.ATTACK]: { en: 'Attack', tr: 'Hücum' },
        [PlayerAbilityType.DEFENSE]: { en: 'Defense', tr: 'Savunma' },
        [PlayerAbilityType.CREATIVITY]: { en: 'Creativity', tr: 'Yaratıcılık' },
        [PlayerAbilityType.TECHNOLOGY]: { en: 'Technology', tr: 'Teknik' }
    };
    return names[type]?.[lang] || 'Unknown';
}
/**
 * Check if ability is goalkeeper specific
 */
function isGoalkeeperAbility(type) {
    return type === PlayerAbilityType.SAVE;
}
