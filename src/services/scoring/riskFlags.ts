/**
 * Risk Flags - Standardized Enum & Penalty Table
 *
 * Defines all possible risk flags for prediction quality assessment
 * Each flag has associated confidence penalty
 *
 * @author GoalGPT Team
 * @version 1.0.0
 */

/**
 * Risk flag enum (EXHAUSTIVE list)
 */
export enum RiskFlag {
  // === DATA COMPLETENESS FLAGS ===
  /** Critical: xG data missing (blocks O25, BTTS, HT_O05, O35, HOME_O15) */
  MISSING_XG = 'MISSING_XG',

  /** Critical: FootyStats potentials missing (market-specific blocking) */
  MISSING_POTENTIALS = 'MISSING_POTENTIALS',

  /** Specific: Over 2.5 potential missing */
  MISSING_POTENTIAL_O25 = 'MISSING_POTENTIAL_O25',

  /** Specific: BTTS potential missing */
  MISSING_POTENTIAL_BTTS = 'MISSING_POTENTIAL_BTTS',

  /** Critical: Half-time potential missing (blocks HT_O05) */
  MISSING_POTENTIAL_HT = 'MISSING_POTENTIAL_HT',

  /** Specific: Over 1.5 potential missing */
  MISSING_POTENTIAL_O15 = 'MISSING_POTENTIAL_O15',

  /** Critical: Corners potential missing (blocks CORNERS_O85) */
  MISSING_POTENTIAL_CORNERS = 'MISSING_POTENTIAL_CORNERS',

  /** Critical: Cards potential missing (blocks CARDS_O25) */
  MISSING_POTENTIAL_CARDS = 'MISSING_POTENTIAL_CARDS',

  /** Minor: Betting odds missing (edge calculation skipped) */
  MISSING_ODDS = 'MISSING_ODDS',

  /** Minor: H2H stats missing */
  MISSING_H2H = 'MISSING_H2H',

  /** Minor: Trends (form) data missing */
  MISSING_TRENDS = 'MISSING_TRENDS',

  /** Known limitation: Referee data not available */
  NO_REFEREE_DATA = 'NO_REFEREE_DATA',

  // === DATA QUALITY FLAGS ===
  /** Odds suspiciously low (<1.10 for favorite) */
  EXTREME_ODDS = 'EXTREME_ODDS',

  /** League has low data sample size */
  LOW_SAMPLE_LEAGUE = 'LOW_SAMPLE_LEAGUE',

  /** 3rd division or obscure league (poor data quality) */
  LOW_TIER_LEAGUE = 'LOW_TIER_LEAGUE',

  // === PREDICTION QUALITY FLAGS ===
  /** Components strongly disagree (variance > 0.25) */
  HIGH_VARIANCE = 'HIGH_VARIANCE',

  /** Components produce contradictory signals */
  CONFLICT_SIGNALS = 'CONFLICT_SIGNALS',

  /** Predicted probability very low (< 40%) */
  LOW_PROBABILITY = 'LOW_PROBABILITY',

  /** Predicted probability suspiciously high (> 95%) */
  OVERCONFIDENT = 'OVERCONFIDENT',

  // === MARKET-SPECIFIC FLAGS ===
  /** O25: Lambda (xG total) below minimum threshold */
  LAMBDA_TOO_LOW = 'LAMBDA_TOO_LOW',

  /** BTTS: One team has very low scoring probability (<40%) */
  ONE_SIDED_BTTS = 'ONE_SIDED_BTTS',

  /** HT_O05: No early goal proxy available */
  NO_EARLY_GOAL_PROXY = 'NO_EARLY_GOAL_PROXY',

  /** HOME_O15: Home team has very low xG */
  WEAK_HOME_ATTACK = 'WEAK_HOME_ATTACK',

  /** Opponent has unusually strong defense */
  STRONG_DEFENSE_OPPONENT = 'STRONG_DEFENSE_OPPONENT',

  // === SETTLEMENT FLAGS ===
  /** Corner data not available for this league */
  CORNERS_DATA_UNAVAILABLE = 'CORNERS_DATA_UNAVAILABLE',

  /** Card data not available for this league */
  CARDS_DATA_UNAVAILABLE = 'CARDS_DATA_UNAVAILABLE',

  /** Half-time score not tracked for this league */
  HT_SCORE_UNAVAILABLE = 'HT_SCORE_UNAVAILABLE',
}

/**
 * Confidence penalty table
 * Maps risk flags to confidence score penalties
 */
export const CONFIDENCE_PENALTIES: Record<RiskFlag, number> = {
  // DATA COMPLETENESS (Critical: -15 to -25)
  [RiskFlag.MISSING_XG]: -20,
  [RiskFlag.MISSING_POTENTIALS]: -15,
  [RiskFlag.MISSING_POTENTIAL_O25]: -15,
  [RiskFlag.MISSING_POTENTIAL_BTTS]: -15,
  [RiskFlag.MISSING_POTENTIAL_HT]: -20,
  [RiskFlag.MISSING_POTENTIAL_O15]: -15,
  [RiskFlag.MISSING_POTENTIAL_CORNERS]: -20,
  [RiskFlag.MISSING_POTENTIAL_CARDS]: -20,
  [RiskFlag.MISSING_ODDS]: -5,
  [RiskFlag.MISSING_H2H]: -3,
  [RiskFlag.MISSING_TRENDS]: -5,
  [RiskFlag.NO_REFEREE_DATA]: -10,

  // DATA QUALITY (Medium: -8 to -12)
  [RiskFlag.EXTREME_ODDS]: -10,
  [RiskFlag.LOW_SAMPLE_LEAGUE]: -8,
  [RiskFlag.LOW_TIER_LEAGUE]: -12,

  // PREDICTION QUALITY (Medium to High: -12 to -20)
  [RiskFlag.HIGH_VARIANCE]: -12,
  [RiskFlag.CONFLICT_SIGNALS]: -15,
  [RiskFlag.LOW_PROBABILITY]: -10,
  [RiskFlag.OVERCONFIDENT]: -8,

  // MARKET-SPECIFIC (Medium: -10 to -15)
  [RiskFlag.LAMBDA_TOO_LOW]: -15,
  [RiskFlag.ONE_SIDED_BTTS]: -12,
  [RiskFlag.NO_EARLY_GOAL_PROXY]: -15,
  [RiskFlag.WEAK_HOME_ATTACK]: -12,
  [RiskFlag.STRONG_DEFENSE_OPPONENT]: -10,

  // SETTLEMENT (Info only: -5)
  [RiskFlag.CORNERS_DATA_UNAVAILABLE]: -5,
  [RiskFlag.CARDS_DATA_UNAVAILABLE]: -5,
  [RiskFlag.HT_SCORE_UNAVAILABLE]: -5,
};

/**
 * Blocking flags (prevent publish if present)
 */
export const BLOCKING_FLAGS: RiskFlag[] = [
  RiskFlag.MISSING_XG,
  RiskFlag.MISSING_POTENTIAL_HT,
  RiskFlag.MISSING_POTENTIAL_CORNERS,
  RiskFlag.MISSING_POTENTIAL_CARDS,
  RiskFlag.LOW_TIER_LEAGUE,
  RiskFlag.CONFLICT_SIGNALS,
];

/**
 * Warning flags (publish allowed but user should be aware)
 */
export const WARNING_FLAGS: RiskFlag[] = [
  RiskFlag.MISSING_ODDS,
  RiskFlag.NO_REFEREE_DATA,
  RiskFlag.HIGH_VARIANCE,
  RiskFlag.LOW_SAMPLE_LEAGUE,
];

/**
 * Info flags (informational only, minimal impact)
 */
export const INFO_FLAGS: RiskFlag[] = [
  RiskFlag.MISSING_H2H,
  RiskFlag.MISSING_TRENDS,
  RiskFlag.CORNERS_DATA_UNAVAILABLE,
  RiskFlag.CARDS_DATA_UNAVAILABLE,
  RiskFlag.HT_SCORE_UNAVAILABLE,
];

/**
 * Check if flag is blocking
 */
export function isBlockingFlag(flag: RiskFlag): boolean {
  return BLOCKING_FLAGS.includes(flag);
}

/**
 * Check if flag is warning
 */
export function isWarningFlag(flag: RiskFlag): boolean {
  return WARNING_FLAGS.includes(flag);
}

/**
 * Check if flag is info
 */
export function isInfoFlag(flag: RiskFlag): boolean {
  return INFO_FLAGS.includes(flag);
}

/**
 * Get penalty for a given risk flag
 */
export function getPenalty(flag: RiskFlag): number {
  return CONFIDENCE_PENALTIES[flag] || 0;
}

/**
 * Calculate total penalty from multiple flags
 */
export function calculateTotalPenalty(flags: RiskFlag[]): number {
  return flags.reduce((total, flag) => total + getPenalty(flag), 0);
}

/**
 * Get flag severity level
 */
export function getFlagSeverity(flag: RiskFlag): 'BLOCKING' | 'WARNING' | 'INFO' {
  if (isBlockingFlag(flag)) return 'BLOCKING';
  if (isWarningFlag(flag)) return 'WARNING';
  return 'INFO';
}

/**
 * Format risk flags for display
 */
export function formatRiskFlags(flags: RiskFlag[]): string {
  if (flags.length === 0) return 'No risk flags';

  const blocking = flags.filter(isBlockingFlag);
  const warning = flags.filter(isWarningFlag);
  const info = flags.filter(isInfoFlag);

  const parts: string[] = [];

  if (blocking.length > 0) {
    parts.push(`🔴 BLOCKING: ${blocking.join(', ')}`);
  }

  if (warning.length > 0) {
    parts.push(`🟡 WARNING: ${warning.join(', ')}`);
  }

  if (info.length > 0) {
    parts.push(`🔵 INFO: ${info.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Check if any blocking flags present
 */
export function hasBlockingFlags(flags: RiskFlag[]): boolean {
  return flags.some(isBlockingFlag);
}

/**
 * Export risk flags utilities
 */
export const riskFlagsUtils = {
  isBlockingFlag,
  isWarningFlag,
  isInfoFlag,
  getPenalty,
  calculateTotalPenalty,
  getFlagSeverity,
  formatRiskFlags,
  hasBlockingFlags,
};
