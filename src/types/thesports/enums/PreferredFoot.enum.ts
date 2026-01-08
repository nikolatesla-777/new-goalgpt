/**
 * Preferred Foot Enum
 * 
 * Represents player's preferred foot
 */

export enum PreferredFoot {
  UNKNOWN = 0,    // Unknown (Bilinmiyor)
  LEFT = 1,       // Left foot (Sol ayak)
  RIGHT = 2,      // Right foot (Sağ ayak)
  BOTH = 3        // Both feet (Her iki ayak)
}

/**
 * Get preferred foot display name
 */
export function getPreferredFootName(foot: PreferredFoot, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<PreferredFoot, { en: string; tr: string }> = {
    [PreferredFoot.UNKNOWN]: { en: 'Unknown', tr: 'Bilinmiyor' },
    [PreferredFoot.LEFT]: { en: 'Left', tr: 'Sol' },
    [PreferredFoot.RIGHT]: { en: 'Right', tr: 'Sağ' },
    [PreferredFoot.BOTH]: { en: 'Both', tr: 'Her İkisi' }
  };
  return names[foot]?.[lang] || 'Unknown';
}

/**
 * Get foot emoji for UI
 */
export function getFootEmoji(foot: PreferredFoot): string {
  switch (foot) {
    case PreferredFoot.LEFT:
      return '🦶⬅️';
    case PreferredFoot.RIGHT:
      return '🦶➡️';
    case PreferredFoot.BOTH:
      return '🦶🦶';
    default:
      return '❓';
  }
}
