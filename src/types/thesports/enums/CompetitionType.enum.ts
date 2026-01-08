/**
 * Competition Type Enum
 * 
 * Represents the type of competition
 */

export enum CompetitionType {
  UNKNOWN = 0,    // Unknown (Bilinmiyor)
  LEAGUE = 1,     // League (Lig)
  CUP = 2,        // Cup (Kupa)
  FRIENDLY = 3    // Friendly (Hazırlık maçı)
}

/**
 * Get competition type display name
 */
export function getCompetitionTypeName(type: CompetitionType, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<CompetitionType, { en: string; tr: string }> = {
    [CompetitionType.UNKNOWN]: { en: 'Unknown', tr: 'Bilinmiyor' },
    [CompetitionType.LEAGUE]: { en: 'League', tr: 'Lig' },
    [CompetitionType.CUP]: { en: 'Cup', tr: 'Kupa' },
    [CompetitionType.FRIENDLY]: { en: 'Friendly', tr: 'Hazırlık Maçı' }
  };
  return names[type]?.[lang] || 'Unknown';
}

/**
 * Check if competition type is league
 */
export function isLeague(type: CompetitionType): boolean {
  return type === CompetitionType.LEAGUE;
}

/**
 * Check if competition type is cup
 */
export function isCup(type: CompetitionType): boolean {
  return type === CompetitionType.CUP;
}
