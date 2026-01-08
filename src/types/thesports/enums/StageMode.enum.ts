/**
 * Stage Mode Enum
 * 
 * Represents the match mode for a competition stage
 */

export enum StageMode {
  POINTS = 1,       // Points-based (Puan sistemi - lig formatı)
  ELIMINATION = 2   // Elimination (Eleme sistemi - kupa formatı)
}

/**
 * Get stage mode display name
 */
export function getStageModeName(mode: StageMode, lang: 'en' | 'tr' = 'en'): string {
  const names: Record<StageMode, { en: string; tr: string }> = {
    [StageMode.POINTS]: { en: 'Points', tr: 'Puan Sistemi' },
    [StageMode.ELIMINATION]: { en: 'Elimination', tr: 'Eleme Sistemi' }
  };
  return names[mode]?.[lang] || 'Unknown';
}

/**
 * Check if stage uses points system
 */
export function isPointsBased(mode: StageMode): boolean {
  return mode === StageMode.POINTS;
}

/**
 * Check if stage is knockout/elimination
 */
export function isKnockout(mode: StageMode): boolean {
  return mode === StageMode.ELIMINATION;
}
