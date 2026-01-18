/**
 * Match Statistics Helper Functions
 *
 * Utility functions for processing TheSports API statistics data.
 * These mappings are based on official TheSports API documentation.
 */

/**
 * Convert TheSports API stat type ID to Turkish label
 * CRITICAL: These mappings are based on official TheSports API documentation
 * (TechnicalStatistics & HalfTimeStatistics enums)
 */
export function getStatName(type: number): string {
  const statNames: Record<number, string> = {
    // Basic match stats (from detail_live)
    1: 'Gol',
    2: 'Korner',
    3: 'Sarı Kart',
    4: 'Kırmızı Kart',
    5: 'Ofsayt',
    6: 'Serbest Vuruş',
    7: 'Aut',
    8: 'Penaltı',
    9: 'Oyuncu Değişikliği',
    21: 'İsabetli Şut',
    22: 'İsabetsiz Şut',
    23: 'Atak',
    24: 'Tehlikeli Atak',
    25: 'Top Hakimiyeti (%)',
    37: 'Engellenen Şut',

    // Detailed stats (from team_stats / half_team_stats)
    33: 'Top Sürme',
    34: 'Başarılı Top Sürme',
    36: 'Uzaklaştırma',
    38: 'Top Çalma',
    39: 'Müdahale',
    40: 'Toplam Pas',
    41: 'İsabetli Pas',
    42: 'Kilit Pas',
    43: 'Orta',
    44: 'İsabetli Orta',
    45: 'Uzun Pas',
    46: 'İsabetli Uzun Pas',
    51: 'Faul',
    52: 'Kurtarış',
    63: 'Serbest Vuruş',
    69: 'Direkten Dönen',
    83: 'Toplam Şut',

    // Custom Detailed Stats (Mapped from team_stats/list)
    101: 'Toplam Pas',
    102: 'İsabetli Pas',
    103: 'Kilit Pas',
    104: 'İsabetli Orta',
    105: 'İsabetli Uzun Top',
    106: 'Top Kesme',
    107: 'Faul',
    108: 'Ofsayt',
    109: 'Hızlı Hücum Şutu',
    110: 'İkili Mücadele',
    111: 'Uzaklaştırma',
    112: 'Başarılı Çalım',
    113: 'Kazanılan İkili Mücadele',
    115: 'Direkten Dönen'
  };
  return statNames[type] || '';
}

/**
 * Sort statistics in a logical order for display
 * Groups: Goals -> Shots -> Attack -> Passing -> Dribbles -> Defense -> Discipline
 */
export function sortStats(stats: any[]): any[] {
  const order = [
    // Goals & Basic
    1,  // Goals
    25, // Ball Possession

    // Shots
    83, // Total Shots
    21, // Shots on Target
    22, // Shots off Target
    37, // Blocked Shots
    115, 69, // Woodwork
    109, // Fastbreak shots

    // Attack
    2,  // Corners
    23, // Attacks
    24, // Dangerous Attacks
    5, 108, // Offsides

    // Passing
    40, 101, // Total Passes
    41, 102, // Accurate Passes
    42, 103, // Key Passes
    43, // Crosses
    44, 104, // Accurate Crosses
    45, // Long Balls
    46, 105, // Accurate Long Balls

    // Dribbles
    33, // Dribbles
    34, 112, // Dribble Success

    // Defense
    39, 110, // Tackles / Duels
    113, // Duels Won
    38, 106, // Interceptions
    36, 111, // Clearances
    52, // Saves

    // Discipline
    51, 107, // Fouls
    3,  // Yellow Cards
    4   // Red Cards
  ];

  return [...stats].sort((a, b) => {
    const indexA = order.indexOf(a.type);
    const indexB = order.indexOf(b.type);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Both in list, sort by index
    if (indexA !== -1) return -1; // Only A in list, A comes first
    if (indexB !== -1) return 1;  // Only B in list, B comes first
    return a.type - b.type; // Neither in list, sort by ID
  });
}

/**
 * Stat type interface for type safety
 */
export interface StatItem {
  type: number;
  home: number | string;
  away: number | string;
}

/**
 * Filter out unknown/unnamed stats
 */
export function filterKnownStats(stats: StatItem[]): StatItem[] {
  return stats.filter(s => getStatName(s.type) !== '');
}

/**
 * Process raw stats: sort and filter in one call
 */
export function processStats(rawStats: any[]): StatItem[] {
  return sortStats(rawStats).filter(s => getStatName(s.type) !== '');
}
