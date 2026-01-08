/**
 * Player Ability Type Enum
 * 
 * Represents player ability score types (1-9)
 * Used in player.ability array: [type_id, rating (0-100), average_score (0-100)]
 */

export enum PlayerAbilityType {
  SAVE = 1,           // Save (Kurtarış) - GK
  PRE_JUDGMENT = 2,   // Pre-judgment (Öngörü)
  HANDLING = 3,       // Handling the ball (Top kontrolü)
  AIR = 4,            // Air (Hava topu)
  TACTICS = 5,        // Tactics (Taktik)
  ATTACK = 6,         // Attack (Hücum)
  DEFENSE = 7,        // Defense (Savunma)
  CREATIVITY = 8,     // Creativity (Yaratıcılık)
  TECHNOLOGY = 9      // Technology (Teknik)
}

/**
 * Get ability type display name
 */
export function getAbilityTypeName(type: PlayerAbilityType, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<PlayerAbilityType, { en: string; tr: string }> = {
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
export function isGoalkeeperAbility(type: PlayerAbilityType): boolean {
  return type === PlayerAbilityType.SAVE;
}
