/**
 * Player Detailed Position Enum
 * 
 * Represents detailed player positions on the field
 * Used in player.positions array: [[main_position], [secondary_positions]]
 */

export enum PlayerDetailedPosition {
  // Forwards
  LW = 'LW',     // Left Forward (Sol kanat)
  RW = 'RW',     // Right Forward (Sağ kanat)
  ST = 'ST',     // Striker/Forward (Forvet)
  
  // Midfielders
  AM = 'AM',     // Attacking Midfielder (Ofansif orta saha)
  ML = 'ML',     // Left Midfielder (Sol orta saha)
  MC = 'MC',     // Center Midfielder (Merkez orta saha)
  MR = 'MR',     // Right Midfielder (Sağ orta saha)
  DM = 'DM',     // Defensive Midfielder (Defansif orta saha)
  
  // Defenders
  DL = 'DL',     // Left Back (Sol bek)
  DC = 'DC',     // Center Back (Stoper)
  DR = 'DR',     // Right Back (Sağ bek)
  
  // Goalkeeper
  GK = 'GK'      // Goalkeeper (Kaleci)
}

/**
 * Get detailed position display name
 */
export function getDetailedPositionName(position: PlayerDetailedPosition, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<PlayerDetailedPosition, { en: string; tr: string }> = {
    [PlayerDetailedPosition.LW]: { en: 'Left Forward', tr: 'Sol Kanat' },
    [PlayerDetailedPosition.RW]: { en: 'Right Forward', tr: 'Sağ Kanat' },
    [PlayerDetailedPosition.ST]: { en: 'Striker', tr: 'Forvet' },
    [PlayerDetailedPosition.AM]: { en: 'Attacking Midfielder', tr: 'Ofansif Orta Saha' },
    [PlayerDetailedPosition.ML]: { en: 'Left Midfielder', tr: 'Sol Orta Saha' },
    [PlayerDetailedPosition.MC]: { en: 'Center Midfielder', tr: 'Merkez Orta Saha' },
    [PlayerDetailedPosition.MR]: { en: 'Right Midfielder', tr: 'Sağ Orta Saha' },
    [PlayerDetailedPosition.DM]: { en: 'Defensive Midfielder', tr: 'Defansif Orta Saha' },
    [PlayerDetailedPosition.DL]: { en: 'Left Back', tr: 'Sol Bek' },
    [PlayerDetailedPosition.DC]: { en: 'Center Back', tr: 'Stoper' },
    [PlayerDetailedPosition.DR]: { en: 'Right Back', tr: 'Sağ Bek' },
    [PlayerDetailedPosition.GK]: { en: 'Goalkeeper', tr: 'Kaleci' }
  };
  return names[position]?.[lang] || position;
}

/**
 * Get general position from detailed position
 */
export function getGeneralPosition(position: PlayerDetailedPosition): 'F' | 'M' | 'D' | 'G' {
  switch (position) {
    case PlayerDetailedPosition.LW:
    case PlayerDetailedPosition.RW:
    case PlayerDetailedPosition.ST:
      return 'F'; // Forward
    case PlayerDetailedPosition.AM:
    case PlayerDetailedPosition.ML:
    case PlayerDetailedPosition.MC:
    case PlayerDetailedPosition.MR:
    case PlayerDetailedPosition.DM:
      return 'M'; // Midfielder
    case PlayerDetailedPosition.DL:
    case PlayerDetailedPosition.DC:
    case PlayerDetailedPosition.DR:
      return 'D'; // Defender
    case PlayerDetailedPosition.GK:
      return 'G'; // Goalkeeper
    default:
      return 'M'; // Default to midfielder
  }
}

/**
 * Check if position is attacking
 */
export function isAttackingPosition(position: PlayerDetailedPosition): boolean {
  return [
    PlayerDetailedPosition.LW,
    PlayerDetailedPosition.RW,
    PlayerDetailedPosition.ST,
    PlayerDetailedPosition.AM
  ].includes(position);
}
