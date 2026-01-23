"use strict";
/**
 * Player Characteristics Enum
 *
 * Represents player technical features/characteristics (1-43)
 * Used in player.characteristics array for advantages and disadvantages
 * Format: [[[type_id, ranking], ...advantages], [[type_id, ranking], ...disadvantages]]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerCharacteristics = void 0;
exports.getCharacteristicName = getCharacteristicName;
exports.isNegativeCharacteristic = isNegativeCharacteristic;
var PlayerCharacteristics;
(function (PlayerCharacteristics) {
    PlayerCharacteristics[PlayerCharacteristics["UNLOADING"] = 1] = "UNLOADING";
    PlayerCharacteristics[PlayerCharacteristics["PENALTY_KICK"] = 2] = "PENALTY_KICK";
    PlayerCharacteristics[PlayerCharacteristics["DIRECT_FREE_KICK"] = 3] = "DIRECT_FREE_KICK";
    PlayerCharacteristics[PlayerCharacteristics["LONG_SHOT"] = 4] = "LONG_SHOT";
    PlayerCharacteristics[PlayerCharacteristics["SINGLE_SHOT"] = 5] = "SINGLE_SHOT";
    PlayerCharacteristics[PlayerCharacteristics["PASS"] = 6] = "PASS";
    PlayerCharacteristics[PlayerCharacteristics["ORGANIZE_ATTACK"] = 7] = "ORGANIZE_ATTACK";
    PlayerCharacteristics[PlayerCharacteristics["DRIBBLE"] = 8] = "DRIBBLE";
    PlayerCharacteristics[PlayerCharacteristics["INTERRUPT_BALL"] = 9] = "INTERRUPT_BALL";
    PlayerCharacteristics[PlayerCharacteristics["TACKLE"] = 10] = "TACKLE";
    PlayerCharacteristics[PlayerCharacteristics["STABILITY"] = 11] = "STABILITY";
    PlayerCharacteristics[PlayerCharacteristics["EXCELLENT"] = 12] = "EXCELLENT";
    PlayerCharacteristics[PlayerCharacteristics["LONG_PASS"] = 13] = "LONG_PASS";
    PlayerCharacteristics[PlayerCharacteristics["BALL_CONTROL"] = 14] = "BALL_CONTROL";
    PlayerCharacteristics[PlayerCharacteristics["AIR_CONFRONTATION"] = 15] = "AIR_CONFRONTATION";
    PlayerCharacteristics[PlayerCharacteristics["GROUND_CONFRONTATION"] = 16] = "GROUND_CONFRONTATION";
    PlayerCharacteristics[PlayerCharacteristics["ERROR_TENDENCY"] = 17] = "ERROR_TENDENCY";
    PlayerCharacteristics[PlayerCharacteristics["DISCIPLINE"] = 18] = "DISCIPLINE";
    PlayerCharacteristics[PlayerCharacteristics["PUNCH_PENALTY"] = 19] = "PUNCH_PENALTY";
    PlayerCharacteristics[PlayerCharacteristics["REACTION"] = 20] = "REACTION";
    PlayerCharacteristics[PlayerCharacteristics["ABANDON_GOAL"] = 21] = "ABANDON_GOAL";
    PlayerCharacteristics[PlayerCharacteristics["HIGH_BALL_INTERCEPTION"] = 22] = "HIGH_BALL_INTERCEPTION";
    PlayerCharacteristics[PlayerCharacteristics["HANDLE_BALL"] = 23] = "HANDLE_BALL";
    PlayerCharacteristics[PlayerCharacteristics["LONG_SHOTS_ABILITY"] = 24] = "LONG_SHOTS_ABILITY";
    PlayerCharacteristics[PlayerCharacteristics["STANCE"] = 25] = "STANCE";
    PlayerCharacteristics[PlayerCharacteristics["HIGH_PRESSING"] = 26] = "HIGH_PRESSING";
    PlayerCharacteristics[PlayerCharacteristics["LONG_SHOTS_SAVE"] = 27] = "LONG_SHOTS_SAVE";
    PlayerCharacteristics[PlayerCharacteristics["CROSSING"] = 28] = "CROSSING";
    PlayerCharacteristics[PlayerCharacteristics["OFFSIDE_AWARENESS"] = 29] = "OFFSIDE_AWARENESS";
    PlayerCharacteristics[PlayerCharacteristics["CLOSE_SHOT_SAVES"] = 30] = "CLOSE_SHOT_SAVES";
    PlayerCharacteristics[PlayerCharacteristics["CONCENTRATION"] = 31] = "CONCENTRATION";
    PlayerCharacteristics[PlayerCharacteristics["DEFENSIVE_PARTICIPATION"] = 32] = "DEFENSIVE_PARTICIPATION";
    PlayerCharacteristics[PlayerCharacteristics["KEY_PASSING_BALL"] = 33] = "KEY_PASSING_BALL";
    PlayerCharacteristics[PlayerCharacteristics["HEADER"] = 34] = "HEADER";
    PlayerCharacteristics[PlayerCharacteristics["SET_BALL"] = 35] = "SET_BALL";
    PlayerCharacteristics[PlayerCharacteristics["STRAIGHT_PASS"] = 36] = "STRAIGHT_PASS";
    PlayerCharacteristics[PlayerCharacteristics["COUNTER_ATTACK"] = 37] = "COUNTER_ATTACK";
    PlayerCharacteristics[PlayerCharacteristics["ONE_KICK"] = 38] = "ONE_KICK";
    PlayerCharacteristics[PlayerCharacteristics["UP_HIGH_BALL"] = 39] = "UP_HIGH_BALL";
    PlayerCharacteristics[PlayerCharacteristics["FOULING"] = 40] = "FOULING";
    PlayerCharacteristics[PlayerCharacteristics["INWARD_CUT"] = 41] = "INWARD_CUT";
    PlayerCharacteristics[PlayerCharacteristics["PUNCHES"] = 42] = "PUNCHES";
    PlayerCharacteristics[PlayerCharacteristics["CLEARANCE"] = 43] = "CLEARANCE"; // Clearance (Uzaklaştırma)
})(PlayerCharacteristics || (exports.PlayerCharacteristics = PlayerCharacteristics = {}));
/**
 * Get characteristic display name
 */
function getCharacteristicName(type, lang = 'en') {
    const names = {
        [PlayerCharacteristics.UNLOADING]: { en: 'Unloading', tr: 'Topu Bırakma' },
        [PlayerCharacteristics.PENALTY_KICK]: { en: 'Penalty Kick', tr: 'Penaltı' },
        [PlayerCharacteristics.DIRECT_FREE_KICK]: { en: 'Direct Free Kick', tr: 'Direkt Serbest Vuruş' },
        [PlayerCharacteristics.LONG_SHOT]: { en: 'Long Shot', tr: 'Uzun Şut' },
        [PlayerCharacteristics.SINGLE_SHOT]: { en: 'Single Shot', tr: 'Tek Vuruş' },
        [PlayerCharacteristics.PASS]: { en: 'Pass', tr: 'Pas' },
        [PlayerCharacteristics.ORGANIZE_ATTACK]: { en: 'Organize Attack', tr: 'Atak Organizasyonu' },
        [PlayerCharacteristics.DRIBBLE]: { en: 'Dribble', tr: 'Dribling' },
        [PlayerCharacteristics.INTERRUPT_BALL]: { en: 'Interrupt Ball', tr: 'Top Kesme' },
        [PlayerCharacteristics.TACKLE]: { en: 'Tackle', tr: 'Müdahale' },
        [PlayerCharacteristics.STABILITY]: { en: 'Stability', tr: 'İstikrar' },
        [PlayerCharacteristics.EXCELLENT]: { en: 'Excellent', tr: 'Mükemmellik' },
        [PlayerCharacteristics.LONG_PASS]: { en: 'Long Pass', tr: 'Uzun Pas' },
        [PlayerCharacteristics.BALL_CONTROL]: { en: 'Ball Control', tr: 'Top Kontrolü' },
        [PlayerCharacteristics.AIR_CONFRONTATION]: { en: 'Air Confrontation', tr: 'Hava Mücadelesi' },
        [PlayerCharacteristics.GROUND_CONFRONTATION]: { en: 'Ground Confrontation', tr: 'Yer Mücadelesi' },
        [PlayerCharacteristics.ERROR_TENDENCY]: { en: 'Error Tendency', tr: 'Hata Eğilimi' },
        [PlayerCharacteristics.DISCIPLINE]: { en: 'Discipline', tr: 'Disiplin' },
        [PlayerCharacteristics.PUNCH_PENALTY]: { en: 'Punch Penalty', tr: 'Yumruk Cezası' },
        [PlayerCharacteristics.REACTION]: { en: 'Reaction', tr: 'Reaksiyon' },
        [PlayerCharacteristics.ABANDON_GOAL]: { en: 'Abandon Goal', tr: 'Kaleyi Terk' },
        [PlayerCharacteristics.HIGH_BALL_INTERCEPTION]: { en: 'High Ball Interception', tr: 'Yüksek Top Kesme' },
        [PlayerCharacteristics.HANDLE_BALL]: { en: 'Handle Ball', tr: 'Top Tutma' },
        [PlayerCharacteristics.LONG_SHOTS_ABILITY]: { en: 'Long Shots', tr: 'Uzun Şutlar' },
        [PlayerCharacteristics.STANCE]: { en: 'Stance', tr: 'Duruş' },
        [PlayerCharacteristics.HIGH_PRESSING]: { en: 'High Pressing', tr: 'Yüksek Pres' },
        [PlayerCharacteristics.LONG_SHOTS_SAVE]: { en: 'Long Shots Save', tr: 'Uzun Şut Kurtarma' },
        [PlayerCharacteristics.CROSSING]: { en: 'Crossing', tr: 'Orta Yapma' },
        [PlayerCharacteristics.OFFSIDE_AWARENESS]: { en: 'Offside Awareness', tr: 'Ofsayt Bilinci' },
        [PlayerCharacteristics.CLOSE_SHOT_SAVES]: { en: 'Close Shot Saves', tr: 'Yakın Şut Kurtarma' },
        [PlayerCharacteristics.CONCENTRATION]: { en: 'Concentration', tr: 'Konsantrasyon' },
        [PlayerCharacteristics.DEFENSIVE_PARTICIPATION]: { en: 'Defensive Participation', tr: 'Savunma Katılımı' },
        [PlayerCharacteristics.KEY_PASSING_BALL]: { en: 'Key Pass', tr: 'Kilit Pas' },
        [PlayerCharacteristics.HEADER]: { en: 'Header', tr: 'Kafa Vuruşu' },
        [PlayerCharacteristics.SET_BALL]: { en: 'Set Piece', tr: 'Duran Top' },
        [PlayerCharacteristics.STRAIGHT_PASS]: { en: 'Straight Pass', tr: 'Düz Pas' },
        [PlayerCharacteristics.COUNTER_ATTACK]: { en: 'Counter Attack', tr: 'Kontra Atak' },
        [PlayerCharacteristics.ONE_KICK]: { en: 'One Kick', tr: 'Tek Vuruş' },
        [PlayerCharacteristics.UP_HIGH_BALL]: { en: 'Up High Ball', tr: 'Yükselen Top' },
        [PlayerCharacteristics.FOULING]: { en: 'Fouling', tr: 'Faul Yapma' },
        [PlayerCharacteristics.INWARD_CUT]: { en: 'Inward Cut', tr: 'İçe Kesme' },
        [PlayerCharacteristics.PUNCHES]: { en: 'Punches', tr: 'Yumruklar' },
        [PlayerCharacteristics.CLEARANCE]: { en: 'Clearance', tr: 'Uzaklaştırma' }
    };
    return names[type]?.[lang] || 'Unknown';
}
/**
 * Check if characteristic is typically negative (disadvantage)
 */
function isNegativeCharacteristic(type) {
    return type === PlayerCharacteristics.ERROR_TENDENCY ||
        type === PlayerCharacteristics.FOULING;
}
