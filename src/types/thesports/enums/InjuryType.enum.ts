/**
 * Injury Type Enum
 * 
 * Represents player injury/availability status (0-3)
 * Used in lineup.injury[].type field
 */

export enum InjuryType {
  UNKNOWN = 0,        // Bilinmiyor
  INJURED = 1,        // Sakatlık
  SUSPENDED = 2,      // Cezalı
  QUESTIONABLE = 3    // Belirsiz
}

/**
 * Get injury type display name
 */
export function getInjuryTypeName(type: InjuryType, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<InjuryType, { en: string; tr: string }> = {
    [InjuryType.UNKNOWN]: { en: 'Unknown', tr: 'Bilinmiyor' },
    [InjuryType.INJURED]: { en: 'Injured', tr: 'Sakatlık' },
    [InjuryType.SUSPENDED]: { en: 'Suspended', tr: 'Cezalı' },
    [InjuryType.QUESTIONABLE]: { en: 'Questionable', tr: 'Belirsiz' }
  };
  return names[type]?.[lang] || 'Unknown';
}

/**
 * Get injury type color for UI
 */
export function getInjuryTypeColor(type: InjuryType): string {
  const colors: Record<InjuryType, string> = {
    [InjuryType.UNKNOWN]: '#9CA3AF',    // Gray
    [InjuryType.INJURED]: '#EF4444',    // Red
    [InjuryType.SUSPENDED]: '#F59E0B',  // Orange/Yellow
    [InjuryType.QUESTIONABLE]: '#3B82F6' // Blue
  };
  return colors[type] || '#9CA3AF';
}

/**
 * Get injury type icon/emoji for UI
 */
export function getInjuryTypeIcon(type: InjuryType): string {
  const icons: Record<InjuryType, string> = {
    [InjuryType.UNKNOWN]: '❓',
    [InjuryType.INJURED]: '🏥',
    [InjuryType.SUSPENDED]: '🟨',
    [InjuryType.QUESTIONABLE]: '⚠️'
  };
  return icons[type] || '❓';
}

/**
 * Check if player is definitely unavailable
 */
export function isUnavailable(type: InjuryType): boolean {
  return type === InjuryType.INJURED || type === InjuryType.SUSPENDED;
}

/**
 * Check if player availability is uncertain
 */
export function isUncertain(type: InjuryType): boolean {
  return type === InjuryType.QUESTIONABLE || type === InjuryType.UNKNOWN;
}
