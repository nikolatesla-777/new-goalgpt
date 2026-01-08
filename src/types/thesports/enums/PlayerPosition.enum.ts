/**
 * Player Position Enum
 * 
 * Represents general player positions (F, M, D, G)
 * Used in player.position field
 */

export enum PlayerPosition {
  FORWARD = 'F',      // Forward (Forvet)
  MIDFIELDER = 'M',   // Midfielder (Orta saha)
  DEFENDER = 'D',     // Defender (Defans)
  GOALKEEPER = 'G'    // Goalkeeper (Kaleci)
}

/**
 * Get position display name
 */
export function getPositionName(position: PlayerPosition, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<PlayerPosition, { en: string; tr: string }> = {
    [PlayerPosition.FORWARD]: { en: 'Forward', tr: 'Forvet' },
    [PlayerPosition.MIDFIELDER]: { en: 'Midfielder', tr: 'Orta Saha' },
    [PlayerPosition.DEFENDER]: { en: 'Defender', tr: 'Defans' },
    [PlayerPosition.GOALKEEPER]: { en: 'Goalkeeper', tr: 'Kaleci' }
  };
  return names[position]?.[lang] || position;
}

/**
 * Get position short name
 */
export function getPositionShortName(position: PlayerPosition, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<PlayerPosition, { en: string; tr: string }> = {
    [PlayerPosition.FORWARD]: { en: 'FW', tr: 'FRV' },
    [PlayerPosition.MIDFIELDER]: { en: 'MF', tr: 'OS' },
    [PlayerPosition.DEFENDER]: { en: 'DF', tr: 'DEF' },
    [PlayerPosition.GOALKEEPER]: { en: 'GK', tr: 'KLC' }
  };
  return names[position]?.[lang] || position;
}

/**
 * Get position color for UI
 */
export function getPositionColor(position: PlayerPosition): string {
  const colors: Record<PlayerPosition, string> = {
    [PlayerPosition.FORWARD]: '#e74c3c',     // Red
    [PlayerPosition.MIDFIELDER]: '#3498db',  // Blue
    [PlayerPosition.DEFENDER]: '#2ecc71',    // Green
    [PlayerPosition.GOALKEEPER]: '#f39c12'   // Orange
  };
  return colors[position] || '#95a5a6';
}
