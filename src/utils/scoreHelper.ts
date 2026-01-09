/**
 * Score Helper Utilities
 *
 * Helper functions for parsing and working with TheSports API score arrays.
 * Created: 2026-01-09 (Phase 2: Type Safety)
 */

import { ScoreArray, SCORE_INDEX, ParsedScore } from '../types/thesports/match/matchBase.types';

/**
 * Parse score array into named fields
 *
 * Safely extracts all score components from TheSports API score array.
 * Handles null/undefined input gracefully by returning zero values.
 *
 * @param scores - Score array from API (can be null/undefined/incomplete)
 * @returns Parsed score object with named fields
 *
 * @example
 * // Normal match
 * const scores = [2, 1, 0, 1, 5, 0, 0];
 * const parsed = parseScoreArray(scores);
 * console.log(parsed.regular);  // 2
 * console.log(parsed.halftime); // 1
 * console.log(parsed.redCards); // 0
 * console.log(parsed.display);  // 2 (no overtime, so regular score)
 *
 * @example
 * // Match with overtime and penalties
 * const scores = [2, 1, 0, 0, 8, 3, 4];
 * const parsed = parseScoreArray(scores);
 * console.log(parsed.overtime);  // 3
 * console.log(parsed.penalty);   // 4
 * console.log(parsed.display);   // 7 (overtime + penalty)
 *
 * @example
 * // Null-safe
 * const parsed = parseScoreArray(null);
 * console.log(parsed.display); // 0
 */
export function parseScoreArray(scores: number[] | ScoreArray | null | undefined): ParsedScore {
  // Safe default: all zeros if input is null/undefined
  const safeScores = scores || [0, 0, 0, 0, 0, 0, 0];

  // Extract individual components using SCORE_INDEX constants
  const regular = safeScores[SCORE_INDEX.REGULAR] || 0;
  const halftime = safeScores[SCORE_INDEX.HALFTIME] || 0;
  const redCards = safeScores[SCORE_INDEX.RED_CARDS] || 0;
  const yellowCards = safeScores[SCORE_INDEX.YELLOW_CARDS] || 0;
  const corners = safeScores[SCORE_INDEX.CORNERS] || 0;
  const overtime = safeScores[SCORE_INDEX.OVERTIME] || 0;
  const penalty = safeScores[SCORE_INDEX.PENALTY] || 0;

  // Calculate display score
  // Logic: If match went to overtime, display = overtime + penalty
  //        Otherwise, display = regular + penalty
  const display = overtime > 0 ? overtime + penalty : regular + penalty;

  return {
    regular,
    halftime,
    redCards,
    yellowCards,
    corners,
    overtime,
    penalty,
    display,
  };
}

/**
 * Format display score with context
 *
 * Returns a formatted string showing the display score with match context.
 * Includes indicators for overtime (AET) and penalties.
 *
 * @param homeScores - Home team score array
 * @param awayScores - Away team score array
 * @returns Formatted score string
 *
 * @example
 * // Normal time
 * formatDisplayScore([2, 1, 0, 1, 5, 0, 0], [1, 0, 0, 0, 3, 0, 0])
 * // Returns: "2-1"
 *
 * @example
 * // After extra time
 * formatDisplayScore([2, 1, 0, 0, 8, 3, 0], [2, 1, 0, 0, 6, 3, 0])
 * // Returns: "3-3 (AET)"
 *
 * @example
 * // After penalties
 * formatDisplayScore([2, 1, 0, 0, 8, 2, 4], [2, 1, 0, 0, 6, 2, 3])
 * // Returns: "6-5 (AET) (6-5 pen)"
 */
export function formatDisplayScore(
  homeScores: number[] | ScoreArray | null | undefined,
  awayScores: number[] | ScoreArray | null | undefined
): string {
  const home = parseScoreArray(homeScores);
  const away = parseScoreArray(awayScores);

  // Base display score
  let result = `${home.display}-${away.display}`;

  // Add context if overtime or penalties occurred
  if (home.overtime > 0 || away.overtime > 0) {
    result += ' (AET)'; // After Extra Time
  }

  if (home.penalty > 0 || away.penalty > 0) {
    // Show penalty score breakdown
    const homePenTotal = home.overtime + home.penalty;
    const awayPenTotal = away.overtime + away.penalty;
    result += ` (${homePenTotal}-${awayPenTotal} pen)`;
  }

  return result;
}

/**
 * Extract specific score component safely
 *
 * Helper to extract a single score component with fallback.
 *
 * @param scores - Score array
 * @param index - Score index (use SCORE_INDEX constants)
 * @param fallback - Fallback value if score is missing (default: 0)
 * @returns Score component value
 *
 * @example
 * const scores = [2, 1, 0, 3, 7, 0, 0];
 * const corners = getScoreComponent(scores, SCORE_INDEX.CORNERS); // 7
 * const redCards = getScoreComponent(scores, SCORE_INDEX.RED_CARDS); // 0
 */
export function getScoreComponent(
  scores: number[] | ScoreArray | null | undefined,
  index: number,
  fallback: number = 0
): number {
  if (!scores || !Array.isArray(scores)) {
    return fallback;
  }

  const value = scores[index];
  return typeof value === 'number' && !isNaN(value) ? value : fallback;
}

/**
 * Check if match went to overtime
 *
 * @param homeScores - Home team score array
 * @param awayScores - Away team score array
 * @returns True if match went to extra time
 *
 * @example
 * hasOvertime([2, 1, 0, 0, 8, 3, 0], [2, 1, 0, 0, 6, 3, 0]) // true
 * hasOvertime([2, 1, 0, 1, 5, 0, 0], [1, 0, 0, 0, 3, 0, 0]) // false
 */
export function hasOvertime(
  homeScores: number[] | ScoreArray | null | undefined,
  awayScores: number[] | ScoreArray | null | undefined
): boolean {
  const homeOT = getScoreComponent(homeScores, SCORE_INDEX.OVERTIME);
  const awayOT = getScoreComponent(awayScores, SCORE_INDEX.OVERTIME);
  return homeOT > 0 || awayOT > 0;
}

/**
 * Check if match went to penalties
 *
 * @param homeScores - Home team score array
 * @param awayScores - Away team score array
 * @returns True if match had penalty shootout
 *
 * @example
 * hasPenalties([2, 1, 0, 0, 8, 2, 4], [2, 1, 0, 0, 6, 2, 3]) // true
 * hasPenalties([2, 1, 0, 0, 8, 3, 0], [2, 1, 0, 0, 6, 3, 0]) // false
 */
export function hasPenalties(
  homeScores: number[] | ScoreArray | null | undefined,
  awayScores: number[] | ScoreArray | null | undefined
): boolean {
  const homePen = getScoreComponent(homeScores, SCORE_INDEX.PENALTY);
  const awayPen = getScoreComponent(awayScores, SCORE_INDEX.PENALTY);
  return homePen > 0 || awayPen > 0;
}

/**
 * Get match winner based on display score
 *
 * @param homeScores - Home team score array
 * @param awayScores - Away team score array
 * @returns 'home' | 'away' | 'draw'
 *
 * @example
 * getMatchWinner([2, 1, 0, 0, 8, 2, 4], [2, 1, 0, 0, 6, 2, 3]) // 'home' (6-5 on pens)
 * getMatchWinner([2, 1, 0, 1, 5, 0, 0], [2, 1, 0, 0, 3, 0, 0]) // 'draw' (2-2)
 */
export function getMatchWinner(
  homeScores: number[] | ScoreArray | null | undefined,
  awayScores: number[] | ScoreArray | null | undefined
): 'home' | 'away' | 'draw' {
  const home = parseScoreArray(homeScores);
  const away = parseScoreArray(awayScores);

  if (home.display > away.display) {
    return 'home';
  } else if (away.display > home.display) {
    return 'away';
  } else {
    return 'draw';
  }
}
