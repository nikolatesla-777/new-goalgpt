/**
 * Coach Type Enum
 * 
 * Represents the type of coach position
 */

export enum CoachType {
  HEAD_COACH = 1,    // Head coach (Ana teknik direktör)
  INTERIM = 2        // Interim head coach (Geçici teknik direktör)
}

/**
 * Get coach type display name
 */
export function getCoachTypeName(type: CoachType, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<CoachType, { en: string; tr: string }> = {
    [CoachType.HEAD_COACH]: { en: 'Head Coach', tr: 'Teknik Direktör' },
    [CoachType.INTERIM]: { en: 'Interim Head Coach', tr: 'Geçici Teknik Direktör' }
  };
  return names[type]?.[lang] || 'Unknown';
}
