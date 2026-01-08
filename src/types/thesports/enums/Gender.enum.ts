/**
 * Gender Enum
 * 
 * Represents gender for competitions, players, teams
 */

export enum Gender {
  MALE = 1,      // Male (Erkek)
  FEMALE = 2     // Female (Kadın)
}

/**
 * Get gender display name
 */
export function getGenderName(gender: Gender, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<Gender, { en: string; tr: string }> = {
    [Gender.MALE]: { en: 'Male', tr: 'Erkek' },
    [Gender.FEMALE]: { en: 'Female', tr: 'Kadın' }
  };
  return names[gender]?.[lang] || 'Unknown';
}
