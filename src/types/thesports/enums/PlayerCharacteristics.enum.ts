/**
 * Player Characteristics Enum
 * 
 * Represents player technical features/characteristics (1-43)
 * Used in player.characteristics array for advantages and disadvantages
 * Format: [[[type_id, ranking], ...advantages], [[type_id, ranking], ...disadvantages]]
 */

export enum PlayerCharacteristics {
  UNLOADING = 1,                    // Unloading (Topu bırakma)
  PENALTY_KICK = 2,                 // Penalty Kick (Penaltı)
  DIRECT_FREE_KICK = 3,             // Direct Free Kick (Direkt serbest vuruş)
  LONG_SHOT = 4,                    // Long Shot (Uzun şut)
  SINGLE_SHOT = 5,                  // Single Shot (Tek vuruş)
  PASS = 6,                         // Pass (Pas)
  ORGANIZE_ATTACK = 7,              // Organize the attack (Atak organizasyonu)
  DRIBBLE = 8,                      // Dribble (Dribling)
  INTERRUPT_BALL = 9,               // Interrupt the ball (Top kesme)
  TACKLE = 10,                      // Tackle (Müdahale)
  STABILITY = 11,                   // Stability (İstikrar)
  EXCELLENT = 12,                   // Excellent (Mükemmellik)
  LONG_PASS = 13,                   // Long pass (Uzun pas)
  BALL_CONTROL = 14,                // Ball control (Top kontrolü)
  AIR_CONFRONTATION = 15,           // Air confrontation (Hava mücadelesi)
  GROUND_CONFRONTATION = 16,        // Ground confrontation (Yer mücadelesi)
  ERROR_TENDENCY = 17,              // Error tendency (Hata eğilimi)
  DISCIPLINE = 18,                  // Discipline (Disiplin)
  PUNCH_PENALTY = 19,               // Punch penalty (Yumruk cezası)
  REACTION = 20,                    // Reaction (Reaksiyon)
  ABANDON_GOAL = 21,                // Abandon goal to participate in attack (Kaleyi terk)
  HIGH_BALL_INTERCEPTION = 22,      // High ball interception (Yüksek top kesme)
  HANDLE_BALL = 23,                 // Handle the ball (Top tutma)
  LONG_SHOTS_ABILITY = 24,          // Long Shots (Uzun şutlar)
  STANCE = 25,                      // Stance (Duruş)
  HIGH_PRESSING = 26,               // High Pressing (Yüksek pres)
  LONG_SHOTS_SAVE = 27,             // Long Shots Save (Uzun şut kurtarma)
  CROSSING = 28,                    // Crossing (Orta yapma)
  OFFSIDE_AWARENESS = 29,           // Offside awareness (Ofsayt bilinci)
  CLOSE_SHOT_SAVES = 30,            // Close shot saves (Yakın şut kurtarma)
  CONCENTRATION = 31,               // Concentration (Konsantrasyon)
  DEFENSIVE_PARTICIPATION = 32,     // Defensive participation (Savunma katılımı)
  KEY_PASSING_BALL = 33,            // Key passing Ball (Kilit pas)
  HEADER = 34,                      // Header (Kafa vuruşu)
  SET_BALL = 35,                    // Set ball (Duran top)
  STRAIGHT_PASS = 36,               // Straight pass (Düz pas)
  COUNTER_ATTACK = 37,              // Counter attack (Kontra atak)
  ONE_KICK = 38,                    // One kick (Tek vuruş)
  UP_HIGH_BALL = 39,                // Up High ball (Yükselen top)
  FOULING = 40,                     // Fouling (Faul yapma)
  INWARD_CUT = 41,                  // Inward cut (İçe kesme)
  PUNCHES = 42,                     // Punches (Yumruklar)
  CLEARANCE = 43                    // Clearance (Uzaklaştırma)
}

/**
 * Get characteristic display name
 */
export function getCharacteristicName(type: PlayerCharacteristics, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<PlayerCharacteristics, { en: string; tr: string }> = {
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
export function isNegativeCharacteristic(type: PlayerCharacteristics): boolean {
  return type === PlayerCharacteristics.ERROR_TENDENCY ||
         type === PlayerCharacteristics.FOULING;
}
